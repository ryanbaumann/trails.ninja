import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
// @ts-expect-error Shared server-side JavaScript guard intentionally has no declaration file.
import { validateGroundingLiteCall } from './server/groundingLiteGate.mjs';
// @ts-expect-error Shared server-side JavaScript auth helpers intentionally have no declaration file.
import { GEMINI_BYOK_HEADER, selectGeminiCredential, validateGeminiCredential } from './server/lib.mjs';

const GMP_SOLUTION_ID = 'gmp_git_agentskills_v1';

// Dev-only proxies for CORS-blocked Google REST APIs and Gemini. Production
// uses server/index.mjs so server-only keys are never bundled into the client.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const gmpKey = env.GMP_SERVER_KEY ?? '';
  // Grounding Lite calls mapstools.googleapis.com server-to-server, so it needs a
  // key with NO HTTP-referrer restriction — a referrer-locked key is rejected with
  // "Requests from referer <empty> are blocked" and the whole Live path degrades to
  // "Live unavailable". `server/index.mjs` already resolves this separately; dev has
  // to agree with it or Live works in production and fails locally.
  const gmpMcpKey = (env.GMP_MCP_KEY ?? '').trim() || gmpKey;
  const geminiKey = env.GEMINI_KEY ?? '';

  const appendKey = (path: string, key: string): string => {
    const [base, query] = path.split('?');
    const params = new URLSearchParams(query ?? '');
    params.set('key', key);
    if (base.includes('/heatmapTiles/')) params.set('solution_id', GMP_SOLUTION_ID);
    return `${base}?${params.toString()}`;
  };

  const capabilitiesPlugin = () => ({
    name: 'atlas-dev-capabilities',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/real-world-reasoning-agent/capabilities', (req, res) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Capabilities only accepts GET');
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({
          maps: Boolean(gmpKey),
          gemini: Boolean(geminiKey),
          groundingLite: Boolean(gmpMcpKey) && env.GROUNDING_LITE_ENABLED === 'true',
        }));
      });
    },
  });

  const geminiValidationPlugin = () => ({
    name: 'atlas-dev-gemini-validation',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/real-world-reasoning-agent/ai/validate', async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, reason: 'method' }));
          return;
        }
        const credential = selectGeminiCredential(req.headers, geminiKey);
        if (credential.source === 'invalid' || credential.source === 'none') {
          res.writeHead(credential.source === 'invalid' ? 401 : 500, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, reason: credential.source === 'invalid' ? 'invalid' : 'missing' }));
          return;
        }
        const result = await validateGeminiCredential(credential.key);
        const status = result.ok ? 200
          : result.reason === 'invalid' ? 401
            : result.reason === 'quota' ? 429
              : result.reason === 'model_unavailable' ? 424
                : 502;
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(result));
      });
    },
  });

  const gmpProxy = (
    target: string,
    strip: RegExp,
    prefix = '',
    headers: Record<string, string> = { 'X-Goog-Maps-Solution-ID': GMP_SOLUTION_ID },
  ): ProxyOptions => ({
    target,
    changeOrigin: true,
    secure: true,
    headers,
    rewrite: (path) => appendKey(prefix + path.replace(strip, ''), gmpKey),
  });

  const placePhotoProxy = () => ({
    name: 'atlas-place-photo-proxy',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/real-world-reasoning-agent/gmp/placephoto', async (req, res) => {
        try {
          const incoming = new URL(req.url ?? '/', 'http://localhost');
          const raw = incoming.searchParams.get('url') ?? '';
          const target = new URL(raw);
          const allowed =
            target.protocol === 'https:' &&
            (target.hostname === 'places.googleapis.com' ||
              target.hostname === 'googleusercontent.com' ||
              target.hostname.endsWith('.googleusercontent.com'));
          if (!allowed) {
            res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('Unsupported photo URL');
            return;
          }
          if (target.hostname === 'places.googleapis.com' && gmpKey) target.searchParams.set('key', gmpKey);
          const up = await fetch(target);
          const buf = Buffer.from(await up.arrayBuffer());
          res.writeHead(up.status, {
            'content-type': up.headers.get('content-type') ?? 'application/octet-stream',
            'content-length': String(buf.length),
            'cache-control': 'public, max-age=3600',
          });
          res.end(buf);
        } catch {
          res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Photo proxy failed');
        }
      });
    },
  });

  const groundingLiteProxy = () => ({
    name: 'atlas-grounding-lite-proxy',
    configureServer(server: import('vite').ViteDevServer) {
      server.middlewares.use('/api/real-world-reasoning-agent/gmp/grounding-lite/mcp', async (req, res) => {
        if (req.method !== 'POST' || !gmpMcpKey) {
          res.writeHead(req.method === 'POST' ? 500 : 405, { 'content-type': 'text/plain; charset=utf-8' });
          res.end(req.method === 'POST' ? 'GMP server key is not configured' : 'Grounding Lite only accepts POST');
          return;
        }
        try {
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of req) {
            const item = Buffer.from(chunk);
            size += item.length;
            if (size > 64 * 1024) throw new Error('body_too_large');
            chunks.push(item);
          }
          const body = Buffer.concat(chunks);
          const parsed = JSON.parse(body.toString('utf8'));
          if (!validateGroundingLiteCall(parsed)) {
            res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
            res.end('MCP tool or arguments are not allowed');
            return;
          }
          const upstream = await fetch('https://mapstools.googleapis.com/mcp', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'X-Goog-Api-Key': gmpMcpKey },
            body,
          });
          const response = Buffer.from(await upstream.arrayBuffer());
          res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
          res.end(response);
        } catch (error) {
          res.writeHead(error instanceof Error && error.message === 'body_too_large' ? 413 : 400, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Invalid Grounding Lite request');
        }
      });
    },
  });

  return {
    base: '/real-world-reasoning-agent/',
    plugins: [capabilitiesPlugin(), geminiValidationPlugin(), react(), placePhotoProxy(), groundingLiteProxy()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      proxy: {
        '/api/real-world-reasoning-agent/gmp/geocode': gmpProxy('https://maps.googleapis.com', /^\/api\/real-world-reasoning-agent\/gmp\/geocode/, '/maps/api/geocode'),
        '/api/real-world-reasoning-agent/gmp/airquality': gmpProxy('https://airquality.googleapis.com', /^\/api\/real-world-reasoning-agent\/gmp\/airquality/),
        '/api/real-world-reasoning-agent/gmp/weather': gmpProxy(
          'https://weather.googleapis.com',
          /^\/api\/real-world-reasoning-agent\/gmp\/weather/,
        ),
        '/api/real-world-reasoning-agent/gmp/pollen': gmpProxy('https://pollen.googleapis.com', /^\/api\/real-world-reasoning-agent\/gmp\/pollen/),
        '/api/real-world-reasoning-agent/gmp/solar': gmpProxy('https://solar.googleapis.com', /^\/api\/real-world-reasoning-agent\/gmp\/solar/),
        '/api/real-world-reasoning-agent/gmp/streetview': gmpProxy('https://maps.googleapis.com', /^\/api\/real-world-reasoning-agent\/gmp\/streetview/),
        '/api/real-world-reasoning-agent/gmp/staticmap': gmpProxy('https://maps.googleapis.com', /^\/api\/real-world-reasoning-agent\/gmp\/staticmap/),
        '/api/real-world-reasoning-agent/ai': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/real-world-reasoning-agent\/ai/, ''),
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq, req) => {
              const credential = selectGeminiCredential(req.headers, geminiKey);
              proxyReq.removeHeader(GEMINI_BYOK_HEADER);
              proxyReq.removeHeader('x-goog-api-key');
              if (credential.source === 'hosted' || credential.source === 'byok') {
                proxyReq.setHeader('x-goog-api-key', credential.key);
              }
            });
          },
        },
      },
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@deck.gl')) return 'deck';
            if (id.includes('@google/genai')) return 'genai';
            if (id.includes('@vis.gl/react-google-maps') || id.includes('@googlemaps/markerclusterer')) return 'maps';
            if (id.includes('react') || id.includes('zustand') || id.includes('lucide-react')) return 'vendor';
          },
        },
      },
    },
  };
});
