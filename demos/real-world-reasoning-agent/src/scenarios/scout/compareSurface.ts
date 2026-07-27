/**
 * Deterministic A2UI comparison surface for Scout's `compare_sites`.
 *
 * The comparison matrix used to be hand-authored by the model via render_surface,
 * which routinely emitted raw `{visibility}` / `{total}` placeholder tokens with
 * no matching data-model paths — so they rendered as literal text. Since every
 * value here is already computed server-side, we build the surface ourselves with
 * plain data bindings (never string tokens), guaranteeing a correct render.
 */
import type { A2uiMessage, ComponentNode } from '@/genui/protocol';
import { ATLAS_CATALOG_ID } from '@/genui/protocol';
import type { ComparePayload } from './controller';

let seq = 0;

interface StatItem {
  label: string;
  value: number;
}
interface RowData {
  heading: string;
  address: string;
  total: string;
  stats: StatItem[];
}

export interface BuiltCompareSurface {
  surfaceId: string;
  messages: A2uiMessage[];
}

/** Build the A2UI messages for a comparison payload. Assumes `payload.ok` with ≥2 rows. */
export function buildCompareSurface(payload: ComparePayload): BuiltCompareSurface {
  const surfaceId = `scout-compare-${++seq}`;
  const rows = payload.rows ?? [];
  const winner = payload.winner;

  const dataRows: RowData[] = rows.map((r) => {
    const s = r.scores;
    return {
      heading: `#${r.rank}  ${r.label}`,
      address: r.address ?? '',
      total: s ? `Total score ${s.total}` : '',
      stats: s
        ? [
            { label: 'Visibility', value: s.visibility },
            { label: 'Condition', value: s.condition },
            { label: 'Activity', value: s.activity },
            { label: 'Access', value: s.access },
            { label: 'Environment', value: s.environment },
          ]
        : [],
    };
  });

  const headerText = payload.area ? `Site comparison — ${payload.area}` : 'Site comparison';
  const winnerText = winner ? `🏆 Recommended: ${winner.label} — total score ${winner.total}` : '';

  const rootChildren = ['cmp-hdr', 'cmp-list'];
  const components: ComponentNode[] = [
    { id: 'cmp-hdr', component: 'Text', variant: 'h3', text: headerText },
    { id: 'cmp-list', component: 'List', direction: 'vertical', children: { componentId: 'cmp-rowTpl', path: '/rows' } },
    { id: 'cmp-rowTpl', component: 'Card', child: 'cmp-rowCol' },
    { id: 'cmp-rowCol', component: 'Column', children: ['cmp-rowHead', 'cmp-rowAddr', 'cmp-rowTotal', 'cmp-rowStats'] },
    { id: 'cmp-rowHead', component: 'Text', variant: 'h5', text: { path: 'heading' } },
    { id: 'cmp-rowAddr', component: 'Text', variant: 'caption', text: { path: 'address' } },
    { id: 'cmp-rowTotal', component: 'Text', variant: 'body', text: { path: 'total' } },
    { id: 'cmp-rowStats', component: 'StatGrid', items: { path: 'stats' } },
  ];

  if (winnerText) {
    rootChildren.push('cmp-winner');
    components.push({ id: 'cmp-winner', component: 'Text', variant: 'body', text: winnerText });
  }
  if (winner) {
    rootChildren.push('cmp-fly');
    components.push(
      {
        id: 'cmp-fly',
        component: 'Button',
        variant: 'primary',
        child: 'cmp-flyLabel',
        action: { event: { name: 'fly_to', context: { lat: winner.location.lat, lng: winner.location.lng, zoom: 17 } } },
      },
      { id: 'cmp-flyLabel', component: 'Text', text: `Fly to ${winner.label}` },
    );
  }

  components.unshift({ id: 'root', component: 'Column', children: rootChildren });

  const messages: A2uiMessage[] = [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: ATLAS_CATALOG_ID } },
    { version: 'v0.9', updateComponents: { surfaceId, components } },
    { version: 'v0.9', updateDataModel: { surfaceId, path: '/rows', value: dataRows } },
  ];

  return { surfaceId, messages };
}
