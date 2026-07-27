import { describe, expect, it } from 'vitest';
import {
  dropUnresolvedTokens,
  getAtPath,
  interpolate,
  normalizeA2uiInput,
  resolveDisplayText,
  resolveDynamic,
  setAtPath,
  topLevelComponentIds,
  validateComponentGraph,
  validateMessages,
} from './protocol';

describe('interpolate', () => {
  const model = {
    ranked: [
      { rank: 1, label: 'Columbus & Green', total: 92, scores: { access: 99 } },
      { rank: 2, label: 'Columbus & Union', total: 88, scores: { access: 97 } },
    ],
    title: 'Corner Scout',
  };

  it('replaces relative-path tokens within a List item scope', () => {
    expect(interpolate('#{rank} {label} — score {total}', model, '/ranked/0')).toBe(
      '#1 Columbus & Green — score 92',
    );
  });

  it('replaces absolute-path and nested tokens', () => {
    expect(interpolate('{/title}: access {scores/access}', model, '/ranked/1')).toBe(
      'Corner Scout: access 97',
    );
  });

  it('leaves unresolvable tokens untouched', () => {
    expect(interpolate('{missing} and {label}', model, '/ranked/0')).toBe('{missing} and Columbus & Green');
  });

  it('leaves object-valued tokens and plain braces untouched', () => {
    expect(interpolate('{scores} stays, so does { spaced }', model, '/ranked/0')).toBe(
      '{scores} stays, so does { spaced }',
    );
  });

  it('is a no-op for strings without braces', () => {
    expect(interpolate('plain text', model)).toBe('plain text');
  });
});

describe('dropUnresolvedTokens', () => {
  it('removes a bare binding-shaped token entirely', () => {
    expect(dropUnresolvedTokens('{headline}')).toBe('');
  });

  it('removes a mid-string token and collapses the whitespace', () => {
    expect(dropUnresolvedTokens('Order at {missing} today')).toBe('Order at today');
  });

  it('preserves prose braces and plain text', () => {
    expect(dropUnresolvedTokens('so does { spaced }')).toBe('so does { spaced }');
    expect(dropUnresolvedTokens('plain')).toBe('plain');
  });
});

describe('resolveDisplayText', () => {
  const model = { creatives: [{ style: 'Golden hour', headline: 'Warm mornings' }] };

  it('interpolates literal mustache tokens within a List item scope', () => {
    expect(resolveDisplayText('{headline}', model, '/creatives/0')).toBe('Warm mornings');
    expect(resolveDisplayText('{style}', model, '/creatives/0')).toBe('Golden hour');
  });

  it('blanks a literal whose bindings are all unresolvable (no raw brace leak)', () => {
    expect(resolveDisplayText('{cta}', model, '/creatives/0')).toBe('');
  });

  it('returns bound data values verbatim without stripping braces', () => {
    const m = { headline: 'Save {50%} now' };
    expect(resolveDisplayText({ path: '/headline' }, m)).toBe('Save {50%} now');
  });

  it('returns empty string for a missing prop', () => {
    expect(resolveDisplayText(undefined, model, '/creatives/0')).toBe('');
  });
});

describe('validateMessages', () => {
  it('accepts a well-formed batch (createSurface + rooted updateComponents + updateDataModel)', () => {
    const result = validateMessages([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'atlas://maps-agentic-ui-catalog' } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['t1'] },
            { id: 't1', component: 'Text', text: 'hello' },
          ],
        },
      },
      { version: 'v0.9', updateDataModel: { surfaceId: 's1', path: '/x', value: 1 } },
    ]);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.messages).toHaveLength(3);
  });

  it('honors existingSurfaces: no "never created" error for a surface created in a prior batch', () => {
    const result = validateMessages(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 's1',
            components: [
              { id: 'root', component: 'Column', children: ['extra'] },
              { id: 'extra', component: 'Text', text: 'more' },
            ],
          },
        },
      ],
      new Set(['s1']),
    );
    expect(result.errors.some((e) => e.includes('was never created'))).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('allows updating an existing surface without re-sending its "root" (partial update)', () => {
    const result = validateMessages(
      [
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 's1',
            components: [{ id: 'extra', component: 'Text', text: 'more' }],
          },
        },
      ],
      new Set(['s1']),
    );
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('still flags "surface never created" for updateComponents when existingSurfaces is not passed', () => {
    const result = validateMessages([
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Column' }],
        },
      },
    ]);
    expect(result.errors.some((e) => e.includes('was never created'))).toBe(true);
  });

  it('rejects a non-array payload', () => {
    const result = validateMessages({ not: 'an array' });
    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(['messages must be a JSON array of A2UI v0.9 messages']);
  });

  it('rejects a bad version literal', () => {
    const result = validateMessages([{ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'x' } }]);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/version must be the literal "v0\.9"/);
  });

  it('rejects an unknown component name', () => {
    const result = validateMessages([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'atlas://maps-agentic-ui-catalog' } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['bogus'] },
            { id: 'bogus', component: 'NotARealComponent' },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown component "NotARealComponent"'))).toBe(true);
  });

  it('flags updateComponents missing a "root" component', () => {
    const result = validateMessages([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: 'atlas://maps-agentic-ui-catalog' } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'notroot', component: 'Text', text: 'hi' }],
        },
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('must include a component with id "root"'))).toBe(true);
  });

  it('flags updateComponents for a surface that was never created', () => {
    const result = validateMessages([
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'ghost',
          components: [{ id: 'root', component: 'Column' }],
        },
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('was never created'))).toBe(true);
  });

  it('rejects missing child references, cycles, duplicate ids, and orphans', () => {
    const result = validateMessages([
      { version: 'v0.9', createSurface: { surfaceId: 'broken', catalogId: 'atlas://maps-agentic-ui-catalog' } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'broken',
          components: [
            { id: 'root', component: 'Column', children: ['loop', 'missing'] },
            { id: 'loop', component: 'Card', child: 'root' },
            { id: 'loop', component: 'Text', text: 'duplicate' },
            { id: 'orphan', component: 'Text', text: 'unreachable' },
          ],
        },
      },
    ]);

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/duplicate component id "loop"/);
    expect(result.errors.join('\n')).toMatch(/missing child "missing"/);
    expect(result.errors.join('\n')).toMatch(/orphaned components: orphan/);
  });
});

describe('validateMessages per-component prop validation', () => {
  const ATLAS = 'atlas://maps-agentic-ui-catalog';
  // Wrap a single component (referenced from root) in a well-formed batch so the
  // only possible error source is the node's own props.
  const withNode = (n: Record<string, unknown>) =>
    validateMessages([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: ATLAS } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Column', children: ['n'] }, { id: 'n', ...n }],
        },
      },
    ]);

  it('flags a missing required prop with an actionable message', () => {
    const result = withNode({ component: 'Image' }); // no url
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('(Image): "url" is required'))).toBe(true);
  });

  it('flags a wrong-type prop (MapPreview lat as a plain string)', () => {
    const result = withNode({ component: 'MapPreview', lat: 'north', lng: -122.4 });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('(MapPreview): "lat" must be a number'))).toBe(true);
  });

  it('accepts a required prop given as a {"path"} binding', () => {
    const result = withNode({ component: 'Image', url: { path: '/photo' } });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a required prop given as a mustache-token string', () => {
    const result = withNode({ component: 'Image', url: '{photoUrl}' });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a required prop given as a correct literal', () => {
    const result = withNode({ component: 'Image', url: 'https://example.com/a.png' });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts numeric literals and bindings for MapPreview lat/lng', () => {
    expect(withNode({ component: 'MapPreview', lat: 37.7, lng: -122.4 }).ok).toBe(true);
    expect(withNode({ component: 'MapPreview', lat: { path: '/lat' }, lng: '{lng}' }).ok).toBe(true);
  });

  it('does not flag components with no prop spec (StatGrid)', () => {
    expect(withNode({ component: 'StatGrid', items: [{ label: 'A', value: 1 }] }).ok).toBe(true);
  });

  // Atlas A2UI v0.9 subset additions (array + required string props).
  it('flags a missing required string prop on a subset component (ConfirmationResult.title)', () => {
    const result = withNode({ component: 'ConfirmationResult' }); // no title
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('(ConfirmationResult): "title" is required'))).toBe(true);
  });

  it('flags a missing required array prop (RouteItinerary.steps)', () => {
    const result = withNode({ component: 'RouteItinerary' }); // no steps
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('(RouteItinerary): "steps" is required — an array'))).toBe(true);
  });

  it('flags a wrong-type array prop (ComparisonTable.columns given a string)', () => {
    const result = withNode({ component: 'ComparisonTable', columns: 'nope', rows: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('(ComparisonTable): "columns" must be an array'))).toBe(true);
  });

  it('accepts a required array prop given as a literal array', () => {
    const result = withNode({ component: 'RouteItinerary', steps: [{ instruction: 'Go north' }] });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a required array prop given as a {"path"} binding', () => {
    const result = withNode({ component: 'RouteItinerary', steps: { path: '/steps' } });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a required array prop given as a mustache-token string', () => {
    const result = withNode({ component: 'RouteItinerary', steps: '{steps}' });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('validateComponentGraph', () => {
  it('walks List templates and reports a reachable cycle without recursion', () => {
    const graph = validateComponentGraph({
      root: { id: 'root', component: 'List', children: { componentId: 'template', path: '/items' } },
      template: { id: 'template', component: 'Card', child: 'root' },
    });
    expect(graph.errors.join('\n')).toMatch(/cycle detected/);
    expect(graph.orphanIds).toEqual([]);
  });
});

describe('normalizeA2uiInput', () => {
  const ATLAS = 'atlas://maps-agentic-ui-catalog';
  const asArray = (v: unknown) => v as Record<string, unknown>[];

  it('turns a bare updateComponents (no createSurface, no root) into a valid batch', () => {
    const normalized = normalizeA2uiInput([
      { version: 'v0.9', updateComponents: { surfaceId: 's1', components: [{ id: 't1', component: 'Text', text: 'hi' }] } },
    ]);
    // validateMessages must now accept it (createSurface prepended, root injected).
    expect(validateMessages(normalized).ok).toBe(true);
    const msgs = asArray(normalized);
    expect(msgs[0].createSurface).toMatchObject({ surfaceId: 's1', catalogId: ATLAS });
    const root = (msgs[1].updateComponents as { components: Record<string, unknown>[] }).components.find((c) => c.id === 'root');
    expect(root).toMatchObject({ component: 'Column', children: ['t1'] });
  });

  it('flattens inline-nested child component objects into the flat list', () => {
    const normalized = normalizeA2uiInput([
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: ATLAS } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'root', component: 'Column', children: [{ id: 'c1', component: 'Text', text: 'nested' }] }],
        },
      },
    ]);
    expect(validateMessages(normalized).ok).toBe(true);
    const comps = (asArray(normalized)[1].updateComponents as { components: Record<string, unknown>[] }).components;
    expect(comps.find((c) => c.id === 'root')?.children).toEqual(['c1']);
    expect(comps.find((c) => c.id === 'c1')).toMatchObject({ component: 'Text', text: 'nested' });
  });

  it('coerces a single message object, a wrong version, and a missing catalogId', () => {
    const normalized = normalizeA2uiInput({ version: 'v1.0', createSurface: { surfaceId: 's1' } });
    const msgs = asArray(normalized);
    expect(Array.isArray(normalized)).toBe(true);
    expect(msgs[0].version).toBe('v0.9');
    expect(msgs[0].createSurface).toMatchObject({ surfaceId: 's1', catalogId: ATLAS });
  });

  it('parses a fenced JSON string payload', () => {
    const raw = '```json\n[{"version":"v0.9","createSurface":{"surfaceId":"s1","catalogId":"' + ATLAS + '"}}]\n```';
    const normalized = normalizeA2uiInput(raw);
    expect(Array.isArray(normalized)).toBe(true);
    expect(asArray(normalized)[0].createSurface).toMatchObject({ surfaceId: 's1' });
  });

  it('does not inject a root when updating a pre-existing surface (partial update)', () => {
    const normalized = normalizeA2uiInput(
      [{ version: 'v0.9', updateComponents: { surfaceId: 's1', components: [{ id: 'extra', component: 'Text', text: 'more' }] } }],
      new Set(['s1']),
    );
    const comps = (asArray(normalized)[0].updateComponents as { components: Record<string, unknown>[] }).components;
    expect(comps.some((c) => c.id === 'root')).toBe(false);
    expect(validateMessages(normalized, new Set(['s1'])).ok).toBe(true);
  });

  it('passes through unrecoverable garbage so the validator reports the array error', () => {
    expect(normalizeA2uiInput('not json at all')).toBe('not json at all');
    expect(validateMessages(normalizeA2uiInput('not json at all')).ok).toBe(false);
  });

  it('repairs a large rootless new surface (the campaign-creative shape) end to end', () => {
    // ~30 flat components, none with id "root" — createSurface + updateComponents
    // in one batch. This is the live campaign path that produced the "must include
    // a component with id root" rejection when injection was skipped.
    const components: Record<string, unknown>[] = [
      { id: 'stats', component: 'StatGrid', items: [{ label: 'Rating', value: '4.6' }] },
    ];
    const cardIds: string[] = [];
    for (let i = 0; i < 12; i++) {
      cardIds.push(`card${i}`);
      components.push({ id: `card${i}`, component: 'Card', child: `ad${i}` });
      components.push({ id: `ad${i}`, component: 'AdCreative', imageRef: `img:${i}`, headline: `H${i}` });
    }
    components.push({ id: 'deck', component: 'List', direction: 'horizontal', children: cardIds });

    const normalized = normalizeA2uiInput([
      { version: 'v0.9', createSurface: { surfaceId: 'campaign-creative-surface', catalogId: ATLAS } },
      { version: 'v0.9', updateComponents: { surfaceId: 'campaign-creative-surface', components } },
    ]);
    // No rejection, and the synthesized root wraps the genuine top-level nodes.
    expect(validateMessages(normalized).ok).toBe(true);
    const comps = (asArray(normalized).find((m) => 'updateComponents' in m)!.updateComponents as { components: Record<string, unknown>[] }).components;
    const root = comps.find((c) => c.id === 'root');
    expect(root).toMatchObject({ component: 'Column' });
    expect(((root as { children: string[] }).children).sort()).toEqual(['deck', 'stats']);
  });

  it('drops operation-less messages (only {version}, no operation)', () => {
    const normalized = normalizeA2uiInput([
      { version: 'v0.9' },
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: ATLAS } },
      { version: 'v0.9', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Column' }] } },
    ]);
    expect(validateMessages(normalized).ok).toBe(true);
    const msgs = asArray(normalized);
    expect(msgs.length).toBe(2); // The empty {version} message was dropped.
    expect(msgs[0]).toHaveProperty('createSurface');
    expect(msgs[1]).toHaveProperty('updateComponents');
  });

  it('wraps a bare top-level components array into updateComponents with inferred surfaceId', () => {
    const normalized = normalizeA2uiInput([
      { version: 'v0.9', createSurface: { surfaceId: 'inferred-surface', catalogId: ATLAS } },
      { version: 'v0.9', components: [{ id: 't1', component: 'Text', text: 'hi' }] },
    ]);
    expect(validateMessages(normalized).ok).toBe(true);
    const msgs = asArray(normalized);
    expect(msgs[1]).toHaveProperty('updateComponents');
    expect((msgs[1].updateComponents as { surfaceId: string }).surfaceId).toBe('inferred-surface');
    const comps = (msgs[1].updateComponents as { components: Record<string, unknown>[] }).components;
    expect(comps.find((c) => c.id === 't1')).toMatchObject({ component: 'Text', text: 'hi' });
  });

  it('wraps a bare components array for a single existing surface (fallback)', () => {
    const normalized = normalizeA2uiInput(
      [{ version: 'v0.9', components: [{ id: 'extra', component: 'Text', text: 'more' }] }],
      new Set(['s1']),
    );
    expect(validateMessages(normalized, new Set(['s1'])).ok).toBe(true);
    const msgs = asArray(normalized);
    expect(msgs[0]).toHaveProperty('updateComponents');
    expect((msgs[0].updateComponents as { surfaceId: string }).surfaceId).toBe('s1');
  });
});

describe('topLevelComponentIds', () => {
  it('returns only the unreferenced nodes (excluding root)', () => {
    expect(
      topLevelComponentIds({
        deck: { id: 'deck', component: 'Column', children: ['a', 'b'] },
        a: { id: 'a', component: 'Text', text: 'a' },
        b: { id: 'b', component: 'Text', text: 'b' },
        stats: { id: 'stats', component: 'StatGrid', items: [] },
      }).sort(),
    ).toEqual(['deck', 'stats']);
  });

  it('follows List template componentId and single-child references', () => {
    expect(
      topLevelComponentIds({
        list: { id: 'list', component: 'List', children: { componentId: 'tpl', path: '/items' } },
        tpl: { id: 'tpl', component: 'Card', child: 'inner' },
        inner: { id: 'inner', component: 'Text', text: 'x' },
      }),
    ).toEqual(['list']);
  });

  it('falls back to every id when all nodes are referenced (never childless)', () => {
    // A→B, B→A: fully referenced, no top-level node. Fall back to all ids.
    expect(
      topLevelComponentIds({
        a: { id: 'a', component: 'Card', child: 'b' },
        b: { id: 'b', component: 'Card', child: 'a' },
      }).sort(),
    ).toEqual(['a', 'b']);
  });
});

describe('getAtPath / setAtPath', () => {
  it('reads nested absolute paths', () => {
    const root = { a: { b: { c: 42 } } };
    expect(getAtPath(root, '/a/b/c')).toBe(42);
  });

  it('reads through array indices', () => {
    const root = { places: [{ placeId: 'P1' }, { placeId: 'P2' }] };
    expect(getAtPath(root, '/places/1/placeId')).toBe('P2');
  });

  it('resolves relative paths against a scopePath', () => {
    const root = { places: [{ placeId: 'P1' }, { placeId: 'P2' }] };
    expect(getAtPath(root, 'placeId', '/places/0')).toBe('P1');
    expect(getAtPath(root, 'placeId', '/places/1')).toBe('P2');
  });

  it('returns undefined for missing paths', () => {
    expect(getAtPath({ a: 1 }, '/nope/deep')).toBeUndefined();
  });

  it('sets a nested path, creating intermediate objects and cloning (no mutation of input)', () => {
    const root = { a: { b: 1 } };
    const next = setAtPath(root, '/a/c/d', 99);
    expect(next).toEqual({ a: { b: 1, c: { d: 99 } } });
    expect(root).toEqual({ a: { b: 1 } }); // original untouched
  });

  it('sets an array-indexed path', () => {
    const root = { places: [{ placeId: 'P1' }] };
    const next = setAtPath(root, '/places/0/placeId', 'CHANGED');
    expect((next.places as Array<{ placeId: string }>)[0].placeId).toBe('CHANGED');
  });

  it('replaces the whole model when path is omitted', () => {
    const root = { old: true };
    const next = setAtPath(root, undefined, { fresh: 1 });
    expect(next).toEqual({ fresh: 1 });
  });

  it('replaces the whole model when path is empty string', () => {
    const root = { old: true };
    const next = setAtPath(root, '', { fresh: 2 });
    expect(next).toEqual({ fresh: 2 });
  });
});

describe('resolveDynamic', () => {
  const dataModel = { places: [{ placeId: 'P1' }, { placeId: 'P2' }], title: 'Espresso' };

  it('returns a literal value unchanged', () => {
    expect(resolveDynamic('literal text', dataModel)).toBe('literal text');
    expect(resolveDynamic(42, dataModel)).toBe(42);
  });

  it('resolves an absolute {path} binding', () => {
    expect(resolveDynamic({ path: '/title' }, dataModel)).toBe('Espresso');
  });

  it('resolves a relative {path} binding against a scope', () => {
    expect(resolveDynamic({ path: 'placeId' }, dataModel, '/places/0')).toBe('P1');
    expect(resolveDynamic({ path: 'placeId' }, dataModel, '/places/1')).toBe('P2');
  });

  it('returns undefined for an undefined input', () => {
    expect(resolveDynamic(undefined, dataModel)).toBeUndefined();
  });
});
