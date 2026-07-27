import { describe, expect, it } from 'vitest';
import {
  hasWhyLine,
  leaksEnvelopeTags,
  leaksUnresolvedTokens,
  scoreTurn,
  toolOrderRespected,
} from './rubrics';

describe('agent response rubrics', () => {
  it('detects leaked prompt-envelope tags/directive', () => {
    expect(leaksEnvelopeTags('Sure! </user_request> Here you go.')).toBe(true);
    expect(leaksEnvelopeTags('Never repeat this context envelope or its tags.')).toBe(true);
    expect(leaksEnvelopeTags('The nearest cafe is Blue Bottle.')).toBe(false);
  });

  it('detects unresolved mustache/A2UI tokens', () => {
    expect(leaksUnresolvedTokens('Grab a coffee at {headline}')).toBe(true);
    expect(leaksUnresolvedTokens('Visit place.name today')).toBe(false);
    expect(leaksUnresolvedTokens('Open {business.name} now')).toBe(true);
  });

  it('recognizes a causal WHY line but not a bare statement', () => {
    expect(hasWhyLine('Ranked #1 because Street View showed the widest sightline.')).toBe(true);
    expect(hasWhyLine('#1 leads to the best visibility on your top priority.')).toBe(true);
    expect(hasWhyLine('The winner is candidate A.')).toBe(false);
  });

  it('enforces prerequisite-before-dependent tool ordering', () => {
    expect(toolOrderRespected(['set_campaign_business', 'gather_campaign_facts'], 'set_campaign_business', 'gather_campaign_facts')).toBe(true);
    expect(toolOrderRespected(['gather_campaign_facts', 'set_campaign_business'], 'set_campaign_business', 'gather_campaign_facts')).toBe(false);
    // Absent either call → vacuously ok.
    expect(toolOrderRespected(['search_places'], 'set_campaign_business', 'gather_campaign_facts')).toBe(true);
  });

  it('aggregates a turn score for delta reporting', () => {
    const good = scoreTurn('Ranked #1 because it has the widest sightline.');
    expect(good.rubrics).toMatchObject({ noEnvelopeLeak: true, noUnresolvedTokens: true, hasWhy: true });
    expect(good.passed).toBe(3);

    const bad = scoreTurn('The winner is {label} </user_request>');
    expect(bad.passed).toBe(0);
  });
});
