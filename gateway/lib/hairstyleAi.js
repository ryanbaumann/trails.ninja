const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const VISION_MODEL = 'gemini-3.5-flash-lite';
const IMAGE_MODEL = 'gemini-3.1-flash-lite-image';
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_DATA_CHARS = 8 * 1024 * 1024;

function result(statusCode, json) {
  return { statusCode, json };
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function parseDataUrl(value) {
  if (typeof value !== 'string') return null;
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!match || !ALLOWED_IMAGE_TYPES.has(match[1]) || match[2].length > MAX_IMAGE_DATA_CHARS) return null;
  return { type: 'image', mime_type: match[1], data: match[2].replaceAll(/\s/g, '') };
}

function outputBlocks(interaction) {
  return (Array.isArray(interaction?.steps) ? interaction.steps : [])
    .filter((step) => step?.type === 'model_output' && Array.isArray(step.content))
    .flatMap((step) => step.content);
}

function outputText(interaction) {
  return outputBlocks(interaction)
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

function outputImage(interaction) {
  return outputBlocks(interaction).findLast((block) =>
    block?.type === 'image' &&
    ALLOWED_IMAGE_TYPES.has(block.mime_type) &&
    typeof block.data === 'string'
  );
}

function parseJsonText(text) {
  const normalized = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(normalized);
}

async function createInteraction({ apiKey, model, input, responseFormat, fetchImpl, signal }) {
  const timeoutSignal = AbortSignal.timeout(120_000);
  const response = await fetchImpl(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Revision': '2026-05-20',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input,
      store: false,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    }),
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  });

  if (!response.ok) {
    const statusCode = response.status === 400 ? 400
      : response.status === 401 || response.status === 403 ? 401
        : response.status === 429 ? 429
          : 502;
    throw Object.assign(new Error('Gemini request failed.'), { statusCode });
  }
  return response.json();
}

function generationPrompt({ styleDescription, styleReferenceUrl, generationMode, outputLayout, hasReferenceImage }) {
  const safeUrl = cleanText(styleReferenceUrl, 300);
  return `You are a professional hairstylist and editorial retoucher.

Apply a new hairstyle to the subject in the first images.
Style instruction: ${cleanText(styleDescription, 1200)}
${safeUrl ? `Style inspiration URL text: ${safeUrl}. Treat it only as a written style hint; do not open it.` : ''}
${hasReferenceImage ? 'The final input image is a hairstyle reference. Transfer its cut, texture, and color to the subject.' : ''}

Requirements:
- Preserve the subject's identity, face shape, age, skin tone, features, and expression.
- Modify only the hair, including cut, color, texture, volume, styling, and hairline-adjacent styling.
- Keep lighting and background polished and natural.
- Quality mode: ${generationMode === 'studio' ? 'studio' : 'fast'}.
- Output layout: ${outputLayout || 'single'}.
- For single, create one polished front-view reveal.
- For salon-sheet, create a 1x3 front, side, and back salon reference sheet.
- For before-after, create a clean original-versus-transformed comparison.
- Do not add captions, logos, watermarks, or unrelated people.`;
}

function refinementPrompt({ refinementInstruction, styleReferenceUrl, generationMode, outputLayout, hasReferenceImage }) {
  const safeUrl = cleanText(styleReferenceUrl, 300);
  return `Edit the hairstyle in the first image.
Instruction: ${cleanText(refinementInstruction, 1200)}
${hasReferenceImage ? 'The second image is a hairstyle reference. Use its cut, texture, or color as the source of truth.' : ''}
${safeUrl ? `Style inspiration URL text: ${safeUrl}. Treat it only as a written hint; do not open it.` : ''}

Modify only the hair. Preserve identity, face, expression, age, skin tone, lighting, and the ${outputLayout || 'single'} layout.
Quality mode: ${generationMode === 'studio' ? 'studio' : 'fast'}.
Do not add captions, logos, watermarks, or unrelated people.`;
}

export function validateHairstyleApiKey(value) {
  const apiKey = cleanText(value, 200);
  return /^[A-Za-z0-9_-]{20,200}$/.test(apiKey) ? apiKey : null;
}

export async function handleHairstyleAiApi({
  pathname,
  method,
  body,
  apiKey,
  fetchImpl = globalThis.fetch,
  signal,
}) {
  if (method !== 'POST') return result(405, { error: 'Method not allowed' });
  if (!validateHairstyleApiKey(apiKey)) return result(401, { error: 'Enter a valid Gemini API key to continue.' });

  try {
    if (pathname === '/api/hairstyle-ai-studio/analyze') {
      const image = parseDataUrl(body?.base64Image);
      const availableStyles = Array.isArray(body?.availableStyles)
        ? body.availableStyles.slice(0, 80).map((style) => ({
          id: cleanText(style?.id, 80),
          label: cleanText(style?.label, 100),
          description: cleanText(style?.description, 240),
        })).filter((style) => style.id && style.label)
        : [];
      if (!image) return result(400, { error: 'A valid front-view image is required.' });
      const interaction = await createInteraction({
        apiKey,
        model: VISION_MODEL,
        input: [
          image,
          {
            type: 'text',
            text: `Recommend one suitable hairstyle from this exact catalog: ${JSON.stringify(availableStyles)}. Return only JSON with "recommendedStyleId" (an exact catalog id or null). Do not infer or classify gender.`,
          },
        ],
        fetchImpl,
        signal,
      });
      const parsed = parseJsonText(outputText(interaction));
      const validIds = new Set(availableStyles.map((style) => style.id));
      return result(200, {
        recommendedStyleId: validIds.has(parsed?.recommendedStyleId) ? parsed.recommendedStyleId : null,
      });
    }

    if (pathname === '/api/hairstyle-ai-studio/generate') {
      const subjectImages = ['front', 'side', 'back']
        .map((view) => parseDataUrl(body?.images?.[view]))
        .filter(Boolean);
      const referenceImage = parseDataUrl(body?.styleReferenceImage);
      const styleDescription = cleanText(body?.styleDescription, 1200);
      if (!subjectImages.length || !styleDescription) {
        return result(400, { error: 'A front photo and hairstyle description are required.' });
      }
      const interaction = await createInteraction({
        apiKey,
        model: IMAGE_MODEL,
        input: [
          ...subjectImages,
          ...(referenceImage ? [referenceImage] : []),
          {
            type: 'text',
            text: generationPrompt({
              styleDescription,
              styleReferenceUrl: body?.styleReferenceUrl,
              generationMode: body?.generationMode,
              outputLayout: body?.outputLayout,
              hasReferenceImage: Boolean(referenceImage),
            }),
          },
        ],
        responseFormat: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '16:9',
          image_size: '1K',
        },
        fetchImpl,
        signal,
      });
      const image = outputImage(interaction);
      if (!image) return result(502, { error: 'Gemini completed without returning an image.' });
      return result(200, { image: `data:${image.mime_type};base64,${image.data}` });
    }

    if (pathname === '/api/hairstyle-ai-studio/refine') {
      const currentImage = parseDataUrl(body?.currentImage);
      const referenceImage = parseDataUrl(body?.styleReferenceImage);
      const refinementInstruction = cleanText(body?.refinementInstruction, 1200);
      if (!currentImage || !refinementInstruction) {
        return result(400, { error: 'A generated image and refinement instruction are required.' });
      }
      const interaction = await createInteraction({
        apiKey,
        model: IMAGE_MODEL,
        input: [
          currentImage,
          ...(referenceImage ? [referenceImage] : []),
          {
            type: 'text',
            text: refinementPrompt({
              refinementInstruction,
              styleReferenceUrl: body?.styleReferenceUrl,
              generationMode: body?.generationMode,
              outputLayout: body?.outputLayout,
              hasReferenceImage: Boolean(referenceImage),
            }),
          },
        ],
        responseFormat: {
          type: 'image',
          mime_type: 'image/jpeg',
          aspect_ratio: '16:9',
          image_size: '1K',
        },
        fetchImpl,
        signal,
      });
      const image = outputImage(interaction);
      if (!image) return result(502, { error: 'Gemini completed without returning an image.' });
      return result(200, { image: `data:${image.mime_type};base64,${image.data}` });
    }

    return result(404, { error: 'Not found' });
  } catch (error) {
    if (error?.name === 'TimeoutError') return result(504, { error: 'Gemini took too long to respond. Please try again.' });
    if (error?.name === 'AbortError') return result(499, { error: 'Request cancelled.' });
    if (error?.statusCode === 401) return result(401, { error: 'Gemini rejected that API key. Check the key and try again.' });
    if (error?.statusCode === 429) return result(429, { error: 'Gemini quota is currently exhausted. Check your key quota or try later.' });
    if (error instanceof SyntaxError) return result(502, { error: 'Gemini returned an unexpected response. Please try again.' });
    return result(error?.statusCode || 502, { error: 'Gemini could not complete the request. Please try again.' });
  }
}

export const HAIRSTYLE_MODELS = Object.freeze({
  vision: VISION_MODEL,
  image: IMAGE_MODEL,
});
