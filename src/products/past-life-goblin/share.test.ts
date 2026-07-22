import { describe, expect, it } from 'vitest';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import type { SajuReportData } from '../../lib/saju/report';
import {
  PAST_LIFE_SHARE_EXCLUDED_FIELDS,
  createPastLifeProductShareData,
  createPastLifeShareCards,
  sanitizePastLifeShareText
} from './share';

function privateReport(): SajuReportData {
  const base = buildSajuReport('past-life-goblin', {
    name: '홍길동',
    birthDate: '1992-09-09',
    birthTime: '10:24',
    gender: 'female'
  });
  const privateText = '홍길동님 1992-09-09 user@example.com 010-1234-5678 920909-2123456';

  return {
    ...base,
    badge: `전생 봉인명 · ${privateText}`,
    keyTakeaways: [{ title: '반복되는 업', body: privateText }],
    actionPlan: {
      ...base.actionPlan,
      priorities: [privateText, privateText]
    }
  };
}

describe('past-life public sharing', () => {
  it('shares only the public product landing URL', () => {
    expect(createPastLifeProductShareData('https://unwoldang.example')).toEqual({
      title: 'MZ 도깨비 전생사주',
      text: '사주에 나타난 반복 기질을 상징 서사와 현생 행동으로 읽어보세요.',
      url: 'https://unwoldang.example/detail/past-life-goblin'
    });
  });

  it('removes personal values and common identifiers from every PNG card', () => {
    const serialized = JSON.stringify(createPastLifeShareCards(privateReport()));

    ['홍길동', '1992-09-09', 'user@example.com', '010-1234-5678', '920909-2123456'].forEach(
      (privateValue) => expect(serialized).not.toContain(privateValue)
    );
    expect(serialized).toContain('제외');
  });

  it('uses an explicit exclusion contract and avoids private report URLs', () => {
    expect(PAST_LIFE_SHARE_EXCLUDED_FIELDS).toEqual(
      expect.arrayContaining(['customerName', 'birthLabel', 'serialNumber', 'orderId'])
    );
    expect(JSON.stringify(createPastLifeShareCards(privateReport()))).not.toMatch(/\/report\/|token=|orderId=/u);
  });

  it('keeps useful prose after redaction', () => {
    expect(sanitizePastLifeShareText('홍길동님은 경계를 말합니다.', ['홍길동'])).toBe(
      '고객은 경계를 말합니다.'
    );
  });
});
