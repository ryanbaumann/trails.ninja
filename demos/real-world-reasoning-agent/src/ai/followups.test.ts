import { describe, expect, it } from 'vitest';
import { parseFollowups, buildPrompt, describeCapabilities } from './followups';

describe('parseFollowups', () => {
  it('parses a plain JSON array', () => {
    expect(parseFollowups('["Show me the fastest route", "Compare two neighborhoods"]')).toEqual([
      'Show me the fastest route',
      'Compare two neighborhoods',
    ]);
  });

  it('extracts the array from a fenced / prose-wrapped response', () => {
    const raw = 'Sure! ```json\n["Add a coffee stop", "Extend the trip by a day"]\n``` hope that helps';
    expect(parseFollowups(raw)).toEqual(['Add a coffee stop', 'Extend the trip by a day']);
  });

  it('caps at 3 suggestions and de-dupes case-insensitively', () => {
    const raw = JSON.stringify(['A option', 'a option', 'B option', 'C option', 'D option']);
    expect(parseFollowups(raw)).toEqual(['A option', 'B option', 'C option']);
  });

  it('drops results below the minimum of 2', () => {
    expect(parseFollowups('["only one"]')).toEqual([]);
  });

  it('truncates long suggestions and trims whitespace', () => {
    const long = 'x'.repeat(80);
    const [only] = parseFollowups(JSON.stringify([`  ${long}  `, 'second suggestion here']));
    expect(only.length).toBeLessThanOrEqual(64);
    expect(only.endsWith('…')).toBe(true);
  });

  it('returns [] for non-array or garbage input', () => {
    expect(parseFollowups('not json')).toEqual([]);
    expect(parseFollowups('{"foo":"bar"}')).toEqual([]);
    expect(parseFollowups('')).toEqual([]);
  });

  it('ignores non-string and empty entries', () => {
    expect(parseFollowups('["Keep exploring", 42, "", "  ", "Wrap it up"]')).toEqual([
      'Keep exploring',
      'Wrap it up',
    ]);
  });
});

describe('buildPrompt', () => {
  const prompt = buildPrompt('Scout', 'Score the sites', 'User: find a corner\nAtlas: here');

  it('embeds the journey title, tagline, and transcript', () => {
    expect(prompt).toContain('"Scout"');
    expect(prompt).toContain('Score the sites');
    expect(prompt).toContain('User: find a corner');
  });

  it('nudges toward cross-journey hops, visible payoffs, and shareable finishes', () => {
    expect(prompt).toMatch(/cross-journey hop/i);
    expect(prompt).toMatch(/visible payoff/i);
    expect(prompt).toMatch(/make the postcard|export the campaign/i);
  });

  it('includes a rule that deepens understanding of a produced result (the WHY)', () => {
    expect(prompt).toMatch(/deepens understanding/i);
    expect(prompt).toMatch(/why is #1 the winner\?|explain the tradeoffs/i);
  });

  it('embeds the capability list and a "do not invent features" rule when given', () => {
    const grounded = buildPrompt('Fleet', 'Dispatch', 'User: help', '- assign_job: Assign a job');
    expect(grounded).toContain('- assign_job: Assign a job');
    expect(grounded).toMatch(/only suggest actions Atlas can actually perform/i);
    expect(grounded).toMatch(/never invent/i);
  });

  it('omits the capability block when none is provided (back-compat)', () => {
    expect(prompt).not.toMatch(/capabilities in this journey/i);
  });
});

describe('describeCapabilities', () => {
  it('lists the fleet journey tools without plumbing tools', () => {
    const caps = describeCapabilities('fleet');
    expect(caps).toMatch(/assign_job:/);
    expect(caps).toMatch(/eta_matrix:/);
    // render_surface / show_notice are UI plumbing, not user-facing actions.
    expect(caps).not.toMatch(/render_surface/);
    expect(caps).not.toMatch(/show_notice/);
  });

  it('does not describe a tool the fleet agent lacks (e.g. a traffic heatmap)', () => {
    expect(describeCapabilities('fleet')).not.toMatch(/heatmap/i);
  });
});
