import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildPastLifeProfile } from './pastLifeProfile';
import { buildSajuReport } from './reportBuilder';

const input: Partial<IntakeFormData> = {
  name: '도깨비 고객',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'single',
  relationshipDuration: '',
  location: '서울',
  q1: '전생에서 반복된 관계를 알려주세요.',
  q2: '현생에서 풀 방법을 알려주세요.',
  pastLifeTopic: '연애',
  repeatedScene: '상대의 사정을 이해하다가 결국 혼자 관계를 정리해요.',
  frequentEmotion: '억울함과 피로',
  hiddenDesire: '책임을 내려놓고도 사랑받고 싶어요.',
  chosenSymbol: '붉은 실',
  readingTone: '균형 있게'
};

describe('past-life profile', () => {
  it('keeps the generated character and relationship story deterministic', () => {
    const report = buildSajuReport('past-life-goblin', input);
    const independentlyBuiltReport = buildSajuReport('past-life-goblin', input);
    const first = buildPastLifeProfile(report, input);
    const second = buildPastLifeProfile(report, input);
    const independentProfile = buildPastLifeProfile(independentlyBuiltReport, input);

    expect(second).toEqual(first);
    expect(independentProfile).toEqual(first);
    expect(first.version).toBe('past-life-profile-v2');
    expect(first.storyBeats).toHaveLength(5);
    expect(first.selfPortrait.image).toBe('/media/dokkaebi-guide-self-female.webp');
  });

  it('carries the customer answers into the visible narrative', () => {
    const report = buildSajuReport('past-life-goblin', input);
    const profile = buildPastLifeProfile(report, input);

    expect(profile.customerFocus).toBe('연애');
    expect(profile.repeatedScene).toContain('혼자 관계를 정리');
    expect(profile.frequentEmotion).toBe('억울함과 피로');
    expect(profile.hiddenDesire).toContain('사랑받고 싶어요');
    expect(profile.keepsake).toBe('붉은 실');
    expect(profile.presentEcho).toContain(profile.repeatedScene);
    expect(profile.disclaimer).toContain('상징적 창작 서사');
  });

  it('never depends on a remote image URL for the two portraits', () => {
    const report = buildSajuReport('past-life-goblin', input);
    const profile = buildPastLifeProfile(report, input);

    expect(profile.selfPortrait.image).toMatch(/^\/media\/dokkaebi-guide-self-/);
    expect(profile.connectionPortrait.image).toMatch(/^\/media\/dokkaebi-guide-connection-/);
  });
});
