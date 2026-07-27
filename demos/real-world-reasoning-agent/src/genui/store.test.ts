import { beforeEach, describe, expect, it } from 'vitest';
import { useGenui, genui } from './store';
import type { A2uiMessage } from './protocol';

const CATALOG_ID = 'atlas://maps-agentic-ui-catalog';

beforeEach(() => {
  useGenui.getState().reset();
});

describe('applyMessages', () => {
  it('createSurface → updateComponents → updateDataModel → deleteSurface, bumping rev each step', () => {
    const create: A2uiMessage[] = [
      { version: 'v0.9', createSurface: { surfaceId: 's1', catalogId: CATALOG_ID } },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'root', component: 'Column', children: ['title'] },
            { id: 'title', component: 'Text', text: 'hi' },
          ],
        },
      },
    ];
    const r1 = genui().applyMessages('concierge', create);
    expect(r1.created).toEqual(['s1']);
    expect(r1.updated).toEqual(['s1']);
    expect(r1.deleted).toEqual([]);
    const s1 = genui().getSurface('s1');
    expect(s1).toBeDefined();
    expect(s1?.rev).toBe(2);
    expect(s1?.scenario).toBe('concierge');
    expect(s1?.catalogId).toBe(CATALOG_ID);
    expect(Object.keys(s1?.components ?? {})).toEqual(['root', 'title']);
    expect(s1?.dataModel).toEqual({});

    const update: A2uiMessage[] = [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [
            { id: 'title', component: 'Text', text: 'updated' },
          ],
        },
      },
    ];
    const r2 = genui().applyMessages('concierge', update);
    expect(r2.created).toEqual([]);
    expect(r2.updated).toEqual(['s1']);
    const afterUpdate = genui().getSurface('s1');
    expect(afterUpdate?.rev).toBe(3);
    expect(Object.keys(afterUpdate?.components ?? {})).toEqual(['root', 'title']);
    expect(afterUpdate?.components.title.text).toBe('updated');

    const setData: A2uiMessage[] = [
      { version: 'v0.9', updateDataModel: { surfaceId: 's1', path: '/places', value: [{ placeId: 'P1' }] } },
    ];
    const r3 = genui().applyMessages('concierge', setData);
    expect(r3.updated).toEqual(['s1']);
    const afterData = genui().getSurface('s1');
    expect(afterData?.rev).toBe(4);
    expect(afterData?.dataModel).toEqual({ places: [{ placeId: 'P1' }] });

    // A second updateComponents call upserts by id (last-writer-wins) without clobbering
    // components not mentioned in this batch.
    const patch: A2uiMessage[] = [
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 's1',
          components: [{ id: 'title', component: 'Text', text: 'updated title' }],
        },
      },
    ];
    genui().applyMessages('concierge', patch);
    const afterPatch = genui().getSurface('s1');
    expect(afterPatch?.rev).toBe(5);
    expect(afterPatch?.components.title).toEqual({ id: 'title', component: 'Text', text: 'updated title' });
    expect(afterPatch?.components.root).toBeDefined(); // untouched, still present

    const del: A2uiMessage[] = [{ version: 'v0.9', deleteSurface: { surfaceId: 's1' } }];
    const r4 = genui().applyMessages('concierge', del);
    expect(r4.deleted).toEqual(['s1']);
    expect(genui().getSurface('s1')).toBeUndefined();
  });

  it('updateDataModel with no path replaces the whole data model', () => {
    genui().applyMessages('concierge', [
      { version: 'v0.9', createSurface: { surfaceId: 's2', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 's2', components: [{ id: 'root', component: 'Text', text: 'ready' }] } },
    ]);
    genui().applyMessages('concierge', [
      { version: 'v0.9', updateDataModel: { surfaceId: 's2', path: '/a', value: 1 } },
    ]);
    genui().applyMessages('concierge', [
      { version: 'v0.9', updateDataModel: { surfaceId: 's2', value: { fresh: true } } },
    ]);
    expect(genui().getSurface('s2')?.dataModel).toEqual({ fresh: true });
  });

  it('ignores updateDataModel for a surface that does not exist', () => {
    const r = genui().applyMessages('concierge', [
      { version: 'v0.9', updateDataModel: { surfaceId: 'ghost', path: '/a', value: 1 } },
    ]);
    expect(r.updated).toEqual([]);
    expect(genui().getSurface('ghost')).toBeUndefined();
  });

  it('deleteSurface on a nonexistent surface is a no-op (not reported as deleted)', () => {
    const r = genui().applyMessages('concierge', [{ version: 'v0.9', deleteSurface: { surfaceId: 'ghost' } }]);
    expect(r.deleted).toEqual([]);
  });

  it('rejects an invalid batch atomically and preserves the prior surface', () => {
    genui().applyMessages('concierge', [
      { version: 'v0.9', createSurface: { surfaceId: 'safe', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 'safe', components: [{ id: 'root', component: 'Text', text: 'before' }] } },
    ]);
    const before = genui().getSurface('safe');

    const result = genui().applyMessages('concierge', [
      { version: 'v0.9', updateComponents: { surfaceId: 'safe', components: [{ id: 'root', component: 'Card', child: 'missing' }] } },
      { version: 'v0.9', updateDataModel: { surfaceId: 'safe', path: '/shouldNotCommit', value: true } },
    ]);

    expect(result.created).toEqual([]);
    expect(result.updated).toEqual([]);
    expect(result.errors.join('\n')).toMatch(/missing child "missing"/);
    expect(genui().getSurface('safe')).toEqual(before);
  });

  it('prunes subtrees orphaned by a valid root replacement', () => {
    genui().applyMessages('concierge', [
      { version: 'v0.9', createSurface: { surfaceId: 'cleanup', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 'cleanup', components: [
        { id: 'root', component: 'Column', children: ['old'] },
        { id: 'old', component: 'Button', label: 'Old' },
      ] } },
    ]);

    const result = genui().applyMessages('concierge', [
      { version: 'v0.9', updateComponents: { surfaceId: 'cleanup', components: [
        { id: 'root', component: 'Column', children: ['new'] },
        { id: 'new', component: 'Text', text: 'New' },
      ] } },
    ]);

    expect(result.errors).toEqual([]);
    expect(Object.keys(genui().getSurface('cleanup')?.components ?? {}).sort()).toEqual(['new', 'root']);
  });
});

describe('applyMessages root synthesis', () => {
  // A flat batch of N cards + a container, none with id "root" — the shape the
  // live campaign-creative surface arrives in when the model omits root.
  const rootlessCampaign = (surfaceId: string): A2uiMessage[] => [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: CATALOG_ID } },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId,
        components: [
          { id: 'stats', component: 'StatGrid', items: [{ label: 'Rating', value: '4.6' }] },
          { id: 'card0', component: 'Card', child: 'txt0' },
          { id: 'txt0', component: 'Text', text: 'Fresh brews' },
          { id: 'card1', component: 'Card', child: 'txt1' },
          { id: 'txt1', component: 'Text', text: 'Sunny views' },
          { id: 'deck', component: 'Column', children: ['card0', 'card1'] },
        ],
      },
    },
  ];

  it('(1) new surface, many rootless components → synthesizes a root wrapping the top-level nodes and renders', () => {
    const result = genui().applyMessages('adstudio', rootlessCampaign('camp1'));
    expect(result.errors).toEqual([]);
    expect(result.created).toEqual(['camp1']);
    const surface = genui().getSurface('camp1');
    const root = surface?.components.root;
    expect(root).toMatchObject({ id: 'root', component: 'Column' });
    // Wraps exactly the unreferenced (top-level) nodes; nested cards/texts stay off the root.
    expect((root as unknown as { children: string[] }).children.sort()).toEqual(['deck', 'stats']);
    // No content was lost as orphans — every emitted node survives, reachable from root.
    expect(Object.keys(surface?.components ?? {}).sort()).toEqual(
      ['card0', 'card1', 'deck', 'root', 'stats', 'txt0', 'txt1'],
    );
  });

  it('(2) surface created (rootless) in a prior batch, then a rootless update → still gets a root, no rejection', () => {
    // Prior hop: created + populated without a root. The store synthesizes one.
    const first = genui().applyMessages('adstudio', [
      { version: 'v0.9', createSurface: { surfaceId: 'camp2', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 'camp2', components: [{ id: 'hero', component: 'Text', text: 'v1' }] } },
    ]);
    expect(first.errors).toEqual([]);
    expect((genui().getSurface('camp2')?.components.root as unknown as { children: string[] }).children).toEqual(['hero']);

    // Later hop: another rootless update. The root is preserved (merge semantics);
    // no "missing root" rejection is produced.
    const second = genui().applyMessages('adstudio', [
      { version: 'v0.9', updateComponents: { surfaceId: 'camp2', components: [{ id: 'hero', component: 'Text', text: 'v2' }] } },
    ]);
    expect(second.errors).toEqual([]);
    expect(genui().getSurface('camp2')?.components.root).toBeDefined();
    expect(genui().getSurface('camp2')?.components.hero.text).toBe('v2');
  });

  it('(3) a batch that includes an explicit root is left unchanged (no re-synthesis)', () => {
    genui().applyMessages('adstudio', [
      { version: 'v0.9', createSurface: { surfaceId: 'camp3', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 'camp3', components: [
        { id: 'root', component: 'Card', child: 'only' },
        { id: 'only', component: 'Text', text: 'hi' },
      ] } },
    ]);
    const root = genui().getSurface('camp3')?.components.root;
    // Untouched: keeps the model's own component/child, not a synthesized Column.
    expect(root).toEqual({ id: 'root', component: 'Card', child: 'only' });
  });

  it('(4) a truly empty surface still errors sensibly (nothing to wrap)', () => {
    const result = genui().applyMessages('adstudio', [
      { version: 'v0.9', createSurface: { surfaceId: 'camp4', catalogId: CATALOG_ID } },
    ]);
    expect(result.errors.join('\n')).toMatch(/missing component "root"/);
    expect(genui().getSurface('camp4')).toBeUndefined();
  });
});

describe('clearScenario', () => {
  it('removes only the surfaces belonging to the given scenario', () => {
    genui().applyMessages('concierge', [
      { version: 'v0.9', createSurface: { surfaceId: 'c1', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 'c1', components: [{ id: 'root', component: 'Text', text: 'c' }] } },
    ]);
    genui().applyMessages('insight', [
      { version: 'v0.9', createSurface: { surfaceId: 'i1', catalogId: CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId: 'i1', components: [{ id: 'root', component: 'Text', text: 'i' }] } },
    ]);

    genui().clearScenario('concierge');

    expect(genui().getSurface('c1')).toBeUndefined();
    expect(genui().getSurface('i1')).toBeDefined();
  });
});
