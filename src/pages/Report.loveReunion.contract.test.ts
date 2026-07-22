import { describe, expect, it } from 'vitest';
import type { ReportSection } from '../lib/saju/report';
import { LOVE_REUNION_SECTION_IDS } from '../products/love-reunion/reportModel';
import { orderLoveReunionSections } from './Report';

function section(id: string): ReportSection {
  return { id, title: id };
}

describe('love-reunion report reading order', () => {
  it('puts judgment, contact rules, personal answers, and the 30-day plan first', () => {
    const shuffled = [
      ...LOVE_REUNION_SECTION_IDS.map(section).reverse(),
      section('future-supplement-a'),
      section('future-supplement-b')
    ];

    expect(orderLoveReunionSections(shuffled).map((item) => item.id)).toEqual([
      'current-relationship',
      'contact-boundaries',
      'personal-questions',
      'thirty-day-plan',
      'repeated-pattern',
      'emotional-tempo',
      'connection-signals',
      'timing-guide',
      'recontact-checklist',
      'reunion-maintenance',
      'recovery-direction',
      'future-supplement-a',
      'future-supplement-b'
    ]);
  });

  it('does not mutate the server-backed source section array', () => {
    const source = LOVE_REUNION_SECTION_IDS.map(section);
    const originalIds = source.map((item) => item.id);

    const ordered = orderLoveReunionSections(source);

    expect(source.map((item) => item.id)).toEqual(originalIds);
    expect(ordered).not.toBe(source);
  });
});
