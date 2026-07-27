import { describe, expect, it } from 'vitest';
import { RECIPES, RECIPES_BY_ID } from './registry';
import { COMMON_CAPABILITY_NAMES, declaredCapabilities, manifestById } from './manifest';
import { SCENARIOS, SCENARIO_ORDER } from '@/scenarios/registry';
import { COMMON_TOOLS } from '@/ai/tools/common';

describe('recipe manifests', () => {
  it('covers every scenario exactly once', () => {
    expect(RECIPES.map((r) => r.id).sort()).toEqual([...SCENARIO_ORDER].sort());
    expect(RECIPES_BY_ID.size).toBe(SCENARIO_ORDER.length);
  });

  it('rejects a duplicate recipe id', () => {
    expect(() => manifestById([RECIPES[0], RECIPES[0]])).toThrow(/Duplicate recipe id/);
  });

  it('declares exactly the tools its scenario actually registers', () => {
    // The gate that stops a recipe advertising an action the runtime lacks.
    for (const recipe of RECIPES) {
      const real = SCENARIOS[recipe.id].tools
        .map((tool) => tool.declaration.name)
        .filter((name): name is string => Boolean(name));
      const common = new Set<string>(COMMON_CAPABILITY_NAMES);
      const scenarioSpecific = real.filter((name) => !common.has(name)).sort();
      expect(
        [...recipe.capabilities].sort(),
        `${recipe.id} manifest capabilities drifted from its registered tools`,
      ).toEqual(scenarioSpecific);
    }
  });

  it('keeps the common capability list in step with COMMON_TOOLS', () => {
    const actual = COMMON_TOOLS.map((tool) => tool.declaration.name).filter(Boolean);
    expect([...COMMON_CAPABILITY_NAMES].sort()).toEqual([...actual].sort());
  });

  it('resolves a full capability profile per recipe', () => {
    for (const recipe of RECIPES) {
      const profile = declaredCapabilities(recipe);
      expect(new Set(profile).size, `${recipe.id} has duplicate capabilities`).toBe(profile.length);
      expect(profile).toEqual(expect.arrayContaining([...COMMON_CAPABILITY_NAMES]));
    }
  });

  it('gives every recipe honest, non-empty starters and presentation', () => {
    for (const recipe of RECIPES) {
      expect(recipe.starters.length, `${recipe.id} needs starters`).toBeGreaterThan(0);
      for (const starter of recipe.starters) expect(starter.trim().length).toBeGreaterThan(10);
      expect(recipe.tagline.trim().length).toBeGreaterThan(10);
      expect(recipe.mapMode).toBe(SCENARIOS[recipe.id].mapMode);
      expect(recipe.accent).toBe(SCENARIOS[recipe.id].accent);
      expect(recipe.title).toBe(SCENARIOS[recipe.id].title);
    }
  });

  it('is free of React and host imports so it can describe a recipe elsewhere', async () => {
    const source = await import('node:fs').then(({ readFileSync }) =>
      readFileSync(new URL('./manifest.ts', import.meta.url), 'utf8'),
    );
    expect(source).not.toMatch(/from 'react'|zustand|@vis\.gl|google\.maps/);
  });
});
