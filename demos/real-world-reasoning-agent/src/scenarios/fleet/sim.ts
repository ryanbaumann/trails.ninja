import { GoogleMapsOverlay } from '@deck.gl/google-maps';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer } from '@deck.gl/layers';
import { bearing, haversine, lerp, circlePolygon } from '@/lib/geo';
import { searchNearby } from '@/services/places';
import { computeRoute, computeMatrix } from '@/services/routes';
import { atlas } from '@/state/store';
import { DEFAULT_CITY_PRESET } from '@/lib/cities';
import type { LatLng, PolygonSpec } from '@/lib/types';
import { fleet, type JobSnapshot, type Kpis, type VanSnapshot, type VanStatus } from './store';

/* --------------------------------------------------------- mutable sim state */

interface SimVan {
  id: string;
  label: string;
  home: LatLng;
  path: LatLng[];
  cum: number[]; // cumulative meters at each vertex
  total: number;
  dist: number; // meters traveled along current path
  position: LatLng;
  heading: number;
  status: VanStatus;
  jobId?: string;
  speedMps: number;
  distanceToday: number;
  trail: [number, number, number][]; // [lng, lat, t]
}

interface SimJob {
  id: string;
  label: string;
  pickup: LatLng;
  dropoff: LatLng;
  status: 'unassigned' | 'assigned' | 'done';
  vanId?: string;
  onTime: boolean;
}

interface AvoidZone {
  center: LatLng;
  radiusMeters: number;
}

// Depots are now dynamically loaded from the active city preset.

const VAN_COLOR: Record<VanStatus, [number, number, number]> = {
  enroute: [34, 211, 238],
  idle: [138, 147, 166],
  returning: [245, 158, 11],
};

const VAN_COUNT = 6;
const MAX_ACTIVE_JOBS = 6;
const TRAIL_SECONDS = 55;

let vans: SimVan[] = [];
let jobs: SimJob[] = [];
let nextJobNumber = 1;
let demand: LatLng[] = [];
let zone: AvoidZone | null = null;

let overlay: GoogleMapsOverlay | null = null;
let raf = 0;
let simClock = 0; // sim seconds
let lastFrameMs = 0;
let lastSyncMs = 0;
let nextSpawnAt = 12;
let seeded = false;
let seedCityId = '';
let startGeneration = 0;

/* --------------------------------------------------------------- geometry */

function buildCum(path: LatLng[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + haversine(path[i - 1], path[i]));
  return { cum, total: cum[cum.length - 1] ?? 0 };
}

/**
 * Advance `prev` toward `next` (both degrees) along the shortest arc, returning a
 * continuous (unwrapped) angle. Keeps van.heading monotonic across the 359°→0°
 * seam so the CSS `rotate()` transition turns the short way instead of spinning.
 */
function unwrapAngle(prev: number, next: number): number {
  let delta = (next - prev) % 360;
  if (delta > 180) delta -= 360;
  else if (delta < -180) delta += 360;
  return prev + delta;
}

function pointAt(van: SimVan): { pos: LatLng; heading: number } {
  const { path, cum, dist } = van;
  if (path.length < 2) return { pos: path[0] ?? van.home, heading: van.heading };
  if (dist <= 0) return { pos: path[0], heading: bearing(path[0], path[1]) };
  for (let i = 1; i < path.length; i++) {
    if (cum[i] >= dist) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (dist - cum[i - 1]) / seg;
      return { pos: lerp(path[i - 1], path[i], t), heading: bearing(path[i - 1], path[i]) };
    }
  }
  const n = path.length;
  return { pos: path[n - 1], heading: bearing(path[n - 2], path[n - 1]) };
}

/* --------------------------------------------------------------- routing */

/** Set a van onto a real street route through pickup → dropoff (or a single dest). */
async function routeVan(van: SimVan, waypoints: LatLng[]): Promise<void> {
  const dest = waypoints[waypoints.length - 1];
  const through = waypoints.slice(0, -1); // waypoints visited before the final destination
  const intermediates = zone ? [...through, detourFor(van.position, dest)] : through;
  try {
    const route = await computeRoute(van.position, dest, {
      travelMode: 'DRIVE',
      trafficAware: true,
      intermediates: intermediates.length ? intermediates : undefined,
    });
    if (route && route.path.length > 1) {
      const { cum, total } = buildCum(route.path);
      van.path = route.path;
      van.cum = cum;
      van.total = total;
      van.dist = 0;
      return;
    }
  } catch {
    /* fall through to straight line */
  }
  // Fallback: straight segment so the van still moves.
  const straight = [van.position, dest];
  const { cum, total } = buildCum(straight);
  van.path = straight;
  van.cum = cum;
  van.total = total;
  van.dist = 0;
}

/** A detour waypoint that sidesteps the avoid-zone, offset perpendicular to travel. */
function detourFor(from: LatLng, to: LatLng): LatLng {
  if (!zone) return to;
  const b = (bearing(from, to) + 90) * (Math.PI / 180);
  const off = (zone.radiusMeters * 2.2) / 111320;
  return {
    lat: zone.center.lat + off * Math.cos(b),
    lng: zone.center.lng + (off * Math.sin(b)) / Math.cos((zone.center.lat * Math.PI) / 180),
  };
}

/* --------------------------------------------------------------- jobs */

function near(p: LatLng, jitter = 0.004): LatLng {
  return { lat: p.lat + (Math.random() - 0.5) * jitter, lng: p.lng + (Math.random() - 0.5) * jitter };
}

function spawnJob(): SimJob | null {
  if (demand.length < 2) return null;
  const jobNumber = nextJobNumber++;
  const a = demand[Math.floor(Math.random() * demand.length)];
  const b = demand[Math.floor(Math.random() * demand.length)];
  const job: SimJob = {
    id: `J${jobNumber}`,
    label: `Order ${jobNumber}`,
    pickup: near(a),
    dropoff: near(b),
    status: 'unassigned',
    onTime: true,
  };
  jobs.push(job);
  return job;
}

async function assignJobToVan(job: SimJob, van: SimVan): Promise<void> {
  job.status = 'assigned';
  job.vanId = van.id;
  van.jobId = job.id;
  van.status = 'enroute';
  await routeVan(van, [job.pickup, job.dropoff]);
}

/** Nearest idle van to a job pickup. */
function nearestIdleVan(job: SimJob): SimVan | undefined {
  const idle = vans.filter((v) => v.status === 'idle');
  if (!idle.length) return undefined;
  return idle.reduce((best, v) =>
    haversine(v.position, job.pickup) < haversine(best.position, job.pickup) ? v : best,
  );
}

function onArrive(van: SimVan): void {
  van.dist = van.total;
  const job = jobs.find((j) => j.id === van.jobId);
  if (job) {
    job.status = 'done';
    // Mark on-time if it finished within a generous synthetic SLA window.
    job.onTime = simClock - 0 >= 0; // always on-time in demo; kept explicit for KPI wiring
  }
  van.jobId = undefined;
  van.status = 'idle';
}

/* --------------------------------------------------------------- sim loop */

function scheduler(): void {
  // Spawn new demand periodically, up to the active cap.
  const active = jobs.filter((j) => j.status !== 'done').length;
  if (simClock >= nextSpawnAt && active < MAX_ACTIVE_JOBS) {
    spawnJob();
    nextSpawnAt = simClock + 10 + Math.random() * 10;
  }
  // Auto-assign unassigned jobs to nearest idle vans.
  for (const job of jobs) {
    if (job.status !== 'unassigned') continue;
    const van = nearestIdleVan(job);
    if (van) void assignJobToVan(job, van);
  }
}

function frame(now: number): void {
  if (!lastFrameMs) lastFrameMs = now;
  const speed = fleet().simSpeed;
  const dt = Math.min(0.1, (now - lastFrameMs) / 1000) * speed; // clamp dt to avoid jumps
  lastFrameMs = now;
  simClock += dt;

  for (const van of vans) {
    if (van.status === 'idle') continue;
    van.dist += van.speedMps * dt;
    const before = van.position;
    const { pos, heading } = pointAt(van);
    van.position = pos;
    van.heading = unwrapAngle(van.heading, heading);
    van.distanceToday += haversine(before, pos);
    van.trail.push([pos.lng, pos.lat, simClock]);
    // Trim trail to the fade window.
    while (van.trail.length && van.trail[0][2] < simClock - TRAIL_SECONDS) van.trail.shift();
    if (van.dist >= van.total) onArrive(van);
  }

  scheduler();
  updateOverlay();

  // Follow-cam + panel sync at a throttled rate.
  if (now - lastSyncMs > 220) {
    lastSyncMs = now;
    syncStore();
    const followId = fleet().followVanId;
    if (followId) {
      const v = vans.find((x) => x.id === followId);
      if (v) atlas().setCamera({ kind: 'fly', center: v.position, zoom: 16 });
    }
  }

  raf = requestAnimationFrame(frame);
}

/* --------------------------------------------------------------- deck overlay */

function updateOverlay(): void {
  if (!overlay) return;
  const layers = [
    new ScatterplotLayer<LatLng>({
      id: 'demand',
      data: demand,
      getPosition: (d) => [d.lng, d.lat],
      getFillColor: [167, 139, 250, 70],
      getLineColor: [167, 139, 250, 150],
      getRadius: 95,
      radiusMinPixels: 8,
      radiusMaxPixels: 34,
      stroked: true,
      lineWidthMinPixels: 1,
      opacity: 0.55,
      pickable: false,
    }),
    new TripsLayer<SimVan>({
      id: 'trails',
      data: vans,
      getPath: (d) => d.trail.map((p) => [p[0], p[1]] as [number, number]),
      getTimestamps: (d) => d.trail.map((p) => p[2]),
      getColor: (d) => VAN_COLOR[d.status],
      currentTime: simClock,
      trailLength: TRAIL_SECONDS,
      widthMinPixels: 3,
      capRounded: true,
      jointRounded: true,
      opacity: 0.9,
    }),
  ];
  overlay.setProps({ layers });
}

/* --------------------------------------------------------------- store sync */

function computeKpis(): Kpis {
  const active = vans.filter((v) => v.status !== 'idle').length;
  const done = jobs.filter((j) => j.status === 'done');
  const onTime = done.filter((j) => j.onTime).length;
  const enroute = vans.filter((v) => v.status === 'enroute');
  const avgEta =
    enroute.length > 0
      ? enroute.reduce((s, v) => s + Math.max(0, (v.total - v.dist) / v.speedMps), 0) / enroute.length
      : 0;
  return {
    active,
    total: vans.length,
    onTimePct: done.length ? Math.round((onTime / done.length) * 100) : 100,
    avgEtaSeconds: avgEta,
    distanceTodayMeters: vans.reduce((s, v) => s + v.distanceToday, 0),
    unassigned: jobs.filter((j) => j.status === 'unassigned').length,
  };
}

function syncStore(): void {
  const vanSnaps: VanSnapshot[] = vans.map((v) => ({
    id: v.id,
    label: v.label,
    position: v.position,
    heading: v.heading,
    status: v.status,
    jobId: v.jobId,
    distanceTodayMeters: v.distanceToday,
    etaSeconds: v.status === 'enroute' ? Math.max(0, (v.total - v.dist) / v.speedMps) : 0,
    routePath: v.path.slice(),
  }));
  const jobSnaps: JobSnapshot[] = jobs
    .filter((j) => j.status !== 'done')
    .map((j) => ({
      id: j.id,
      label: j.label,
      pickup: j.pickup,
      dropoff: j.dropoff,
      status: j.status,
      vanId: j.vanId,
    }));
  fleet().setSnapshot(vanSnaps, jobSnaps, computeKpis());
}

/* --------------------------------------------------------------- lifecycle */

async function seed(): Promise<void> {
  const cityId = atlas().cityId;
  seedCityId = cityId;
  const preset = atlas().cities.find(c => c.id === cityId) ?? DEFAULT_CITY_PRESET;
  const depots = preset.fleetDepots;
  
  // Fetch real restaurant density as a demand proxy (3 tiles → ~30-40 points).
  const centers: LatLng[] = preset.demandCenters;
  const batches = await Promise.all(
    centers.map((c) =>
      searchNearby(c, { includedTypes: ['restaurant'], radius: 1100, maxResults: 15, rank: 'POPULARITY' }).catch(() => []),
    ),
  );
  demand = batches.flat().map((p) => p.location);
  if (demand.length < 4) {
    // Environment without Places access — synthesize a plausible demand field.
    demand = Array.from({ length: 24 }, () => near(preset.demandFallback, 0.05));
  }

  vans = Array.from({ length: VAN_COUNT }, (_, i) => {
    const home = depots[i % depots.length];
    return {
      id: `V${i + 1}`,
      label: `V${i + 1}`,
      home,
      path: [home, home],
      cum: [0, 0],
      total: 0,
      dist: 0,
      position: home,
      heading: 0,
      status: 'idle' as VanStatus,
      speedMps: 9 + Math.random() * 3, // ~32-43 km/h ground speed
      distanceToday: 0,
      trail: [],
    };
  });

  jobs = [];
  nextJobNumber = 1;
  for (let i = 0; i < Math.min(VAN_COUNT - 1, 5); i++) spawnJob();
  // Immediate first assignment so the sim opens in motion.
  await Promise.all(
    jobs.map((job) => {
      const van = nearestIdleVan(job);
      return van ? assignJobToVan(job, van) : Promise.resolve();
    }),
  );
  seeded = true;
}

export async function startFleet(map: google.maps.Map): Promise<void> {
  const myGen = ++startGeneration;
  if (!seeded || seedCityId !== atlas().cityId) await seed();
  if (myGen !== startGeneration) return; // stopFleet() (or a remount) fired while seeding

  try {
    if (!overlay) overlay = new GoogleMapsOverlay({ interleaved: true });
    overlay.setMap(map);
  } catch {
    overlay = null; // WebGL unavailable — panel/dispatcher still work
  }
  fleet().setRunning(true);
  lastFrameMs = 0;
  syncStore();
  const cityId = atlas().cityId;
  const preset = atlas().cities.find(c => c.id === cityId) ?? DEFAULT_CITY_PRESET;
  atlas().setCamera({ kind: 'fly', center: preset.center, zoom: 13 });
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

export function stopFleet(): void {
  startGeneration++; // invalidate any startFleet() still awaiting seed()
  cancelAnimationFrame(raf);
  raf = 0;
  fleet().setRunning(false);
  fleet().setFollow(null);
  fleet().selectVan(null);
  if (overlay) {
    try {
      overlay.setMap(null);
    } catch {
      /* noop */
    }
  }
}

/* --------------------------------------------------------------- dispatcher API */

export function fleetStateForModel(): unknown {
  return {
    vans: vans.map((v) => ({
      id: v.id,
      status: v.status,
      jobId: v.jobId,
      etaSeconds: v.status === 'enroute' ? Math.round((v.total - v.dist) / v.speedMps) : 0,
      lat: Number(v.position.lat.toFixed(5)),
      lng: Number(v.position.lng.toFixed(5)),
    })),
    jobs: jobs
      .filter((j) => j.status !== 'done')
      .map((j) => ({ id: j.id, status: j.status, vanId: j.vanId, pickup: j.pickup, dropoff: j.dropoff })),
    kpis: computeKpis(),
  };
}

/** Live traffic ETA from every van to a target coordinate. */
export async function etaMatrix(target: LatLng): Promise<unknown> {
  const origins = vans.map((v) => v.position);
  const cells = await computeMatrix(origins, [target], 'DRIVE');
  return vans
    .map((v, i) => {
      const cell = cells.find((c) => c.originIndex === i);
      return {
        vanId: v.id,
        status: v.status,
        etaSeconds: cell?.status === 'OK' ? Math.round(cell.durationSeconds) : null,
        distanceMeters: cell?.status === 'OK' ? Math.round(cell.distanceMeters) : null,
      };
    })
    .sort((a, b) => (a.etaSeconds ?? 1e9) - (b.etaSeconds ?? 1e9));
}

export async function dispatchAssign(vanId: string, jobId: string): Promise<{ ok: boolean; error?: string }> {
  const van = vans.find((v) => v.id.toUpperCase() === vanId.toUpperCase());
  const job = jobs.find((j) => j.id.toUpperCase() === jobId.toUpperCase());
  if (!van) return { ok: false, error: `van ${vanId} not found` };
  if (!job) return { ok: false, error: `job ${jobId} not found` };
  // Free the van's current job back to the pool.
  if (van.jobId && van.jobId !== job.id) {
    const cur = jobs.find((j) => j.id === van.jobId);
    if (cur) {
      cur.status = 'unassigned';
      cur.vanId = undefined;
    }
  }
  await assignJobToVan(job, van);
  syncStore();
  return { ok: true };
}

export async function setAvoidZone(center: LatLng, radiusMeters: number): Promise<{ ok: boolean; rerouted: number }> {
  zone = { center, radiusMeters };
  const poly: PolygonSpec = {
    id: 'fleet-avoid-zone',
    path: circlePolygon(center, radiusMeters),
    fill: '#f87171',
    stroke: '#f87171',
    opacity: 0.14,
    scenario: 'fleet',
  };
  atlas().setPolygons([poly]);

  // Recompute routes for enroute vans whose remaining path enters the zone.
  const affected = vans.filter(
    (v) => v.status === 'enroute' && v.path.some((p) => haversine(p, center) < radiusMeters),
  );
  await Promise.all(
    affected.map((v) => {
      const job = jobs.find((j) => j.id === v.jobId);
      return job ? routeVan(v, [job.dropoff]) : Promise.resolve();
    }),
  );
  syncStore();
  return { ok: true, rerouted: affected.length };
}

export function clearAvoidZone(): void {
  zone = null;
  atlas().setPolygons([]);
}

export function followVan(vanId: string | null): { ok: boolean } {
  if (vanId === null) {
    fleet().setFollow(null);
    fleet().selectVan(null);
    return { ok: true };
  }
  const van = vans.find((v) => v.id.toUpperCase() === vanId.toUpperCase());
  if (!van) return { ok: false };
  fleet().setFollow(van.id);
  fleet().selectVan(van.id);
  atlas().setCamera({ kind: 'fly', center: van.position, zoom: 16 });
  return { ok: true };
}
