import { describe, expect, it } from 'vitest';
import { REUNION_UNDELETABLE_COPY } from '../reunion/safetyCopy';
import type { SajuReportData } from '../saju/report';
import {
  buildEntityUniverse,
  findNewTextViolations,
  findRemovedUndeletableCopy,
  findUnknownEntities,
  isPermanentlyLockedProse,
  proseGuardModeFor
} from './geminiProseGuard';

/**
 * 통제된 실재 값 집합.
 *
 * 실제 리포트로 만든 집합은 사주에 따라 내용이 달라져 "거부되어야 하는 값" 을 고정할 수
 * 없다. 검사 자체의 경계를 정확히 잠그기 위해 여기서는 집합을 직접 만든다.
 * 실제 리포트와의 결합은 `geminiDraftReview.test.ts` 가 본다.
 */
const universe = buildEntityUniverse(null, {
  currentDayun: { name: '乙巳' },
  yearLuck: [{ year: 2026 }],
  notes: ['식신이 3점 올라 있고 목 비중은 12.5%입니다.', '건록 구간은 3월에 시작합니다.']
} as unknown as SajuReportData);

describe('엔티티 화이트리스트 — 통과해야 하는 케이스', () => {
  it('집합에 있는 간지를 한자·한글 어느 표기로 써도 통과시킨다', () => {
    expect(findUnknownEntities('乙巳 대운이 지나갑니다.', universe)).toEqual([]);
    expect(findUnknownEntities('을사년 흐름을 봅니다.', universe)).toEqual([]);
    expect(findUnknownEntities('을사일주 기준으로 봅니다.', universe)).toEqual([]);
  });

  it('집합에 있는 연도·월·십성·십이운성·퍼센트·점수를 통과시킨다', () => {
    expect(findUnknownEntities('2026년 3월에 식신이 3점 오르고 12.5%가 됩니다.', universe)).toEqual([]);
    expect(findUnknownEntities('건록 구간입니다.', universe)).toEqual([]);
  });

  it('간지와 글자가 겹치는 평범한 한국어 단어를 엔티티로 오탐하지 않는다', () => {
    /*
     * 명세의 출발 패턴은 한글 간지를 문맥 없이 잡았다. 그러면 `임신`·`무술`·`병자`·
     * `신축`·`정오`·`기사`·`신사` 같은 일상어가 전부 '존재하지 않는 간지' 로 걸려
     * 모델이 평범한 한국어를 썼다는 이유로 필드가 조용히 거부된다.
     */
    const ordinary = '임신 준비와 무술 수업, 정오의 병자 진료, 신사 옷차림과 신축 아파트 기사를 갑자기 떠올렸어요.';
    expect(findUnknownEntities(ordinary, universe)).toEqual([]);
  });

  it('한 글자 십이운성과 글자가 겹치는 일상어를 오탐하지 않는다', () => {
    // 쇠·병·사·묘·절·태·양은 사람·병원·양쪽·태도·묘한 과 정면으로 겹친다.
    expect(findUnknownEntities('사람이 병원에서 양쪽 태도를 묘하게 바꿨어요.', universe)).toEqual([]);
  });

  it('개월 수 표현을 월 엔티티로 오탐하지 않는다', () => {
    expect(findUnknownEntities('3개월 정도 지났어요.', universe)).toEqual([]);
    expect(findUnknownEntities('점검할 것이 3가지 있어요.', universe)).toEqual([]);
  });
});

describe('엔티티 화이트리스트 — 거부해야 하는 케이스', () => {
  it('존재하지 않는 간지를 거부한다', () => {
    expect(findUnknownEntities('갑자년에 흐름이 바뀝니다.', universe))
      .toEqual([{ kind: 'ganzhi', token: '갑자' }]);
    // 토큰은 항상 한글로 정규화된다. 한자/한글/혼용/공백 표기가 한 값으로 모여야
    // 거부 메시지와 관측 카운터가 읽히고, 표기만 바꿔 우회하는 경로가 막힌다.
    expect(findUnknownEntities('丙午 대운에 들어갑니다.', universe))
      .toEqual([{ kind: 'ganzhi', token: '병오' }]);
  });

  /**
   * 표기 변형 우회 — 검증에서 9형태 중 6형태가 통과했던 지점이다.
   *
   * 접미사가 **바로** 붙은 형태만 검사했기 때문에, 존재하지 않는 간지를 자연스러운
   * 한국어로 주장하는 가장 흔한 형태들이 전부 무검사로 나갔다.
   */
  it('간지 표기 변형으로 우회할 수 없다', () => {
    const bypasses = [
      '갑자 년에는 흐름이 강해집니다.',
      '갑자 흐름이 강하게 들어옵니다.',
      '甲자년에는 흐름이 강해집니다.',
      '갑 자년에는 흐름이 강해집니다.',
      '올해 간지는 갑자입니다.',
      '갑자 기운이 들어옵니다.',
      '갑자년에 흐름이 바뀝니다.',
      '갑자대운으로 넘어갑니다.',
      '갑자일주로 읽습니다.'
    ];
    bypasses.forEach((text) => {
      expect(findUnknownEntities(text, universe), text)
        .toEqual([{ kind: 'ganzhi', token: '갑자' }]);
    });
  });

  it('지어낸 연도를 거부한다', () => {
    expect(findUnknownEntities('2041년에 다시 만납니다.', universe))
      .toEqual([{ kind: 'year', token: '2041' }]);
  });

  it('근거 없는 퍼센트와 점수를 거부한다', () => {
    expect(findUnknownEntities('회복 여건은 87%입니다.', universe))
      .toEqual([{ kind: 'percent', token: '87' }]);
    expect(findUnknownEntities('종합 4321점으로 평가됩니다.', universe))
      .toEqual([{ kind: 'score', token: '4321' }]);
  });

  it('명식에 없는 십성과 십이운성을 거부한다', () => {
    expect(findUnknownEntities('상관이 강하게 작용합니다.', universe))
      .toEqual([{ kind: 'tenGod', token: '상관' }]);
    expect(findUnknownEntities('십이운성 제왕 구간입니다.', universe))
      .toEqual([{ kind: 'twelveStage', token: '제왕' }]);
  });

  it('계산에 없는 월을 거부한다', () => {
    expect(findUnknownEntities('11월이 분기점입니다.', universe))
      .toEqual([{ kind: 'month', token: '11' }]);
  });

  it('같은 문장의 위반을 여러 종류로 모아서 돌려준다', () => {
    const unknown = findUnknownEntities('2041년 갑자월에 회복률 91%가 됩니다.', universe);
    expect(unknown.map((entity) => entity.kind).sort()).toEqual(['ganzhi', 'percent', 'year']);
  });
});

describe('금지 표현 선검사', () => {
  it('상대 속마음 단정을 draft 단계에서 잡는다', () => {
    const violations = findNewTextViolations(
      '그 사람은 아직 미련이 남아 있어요.',
      '지금 확인된 것과 확인되지 않은 것을 나눠 보겠습니다.',
      'love-reunion'
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it('감시 유도 표현을 잡는다', () => {
    const violations = findNewTextViolations(
      'SNS 스토리를 확인해서 반응을 살펴보세요.',
      '오늘 확인할 것 한 가지만 정리해 드릴게요.',
      'love-reunion'
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it('훈계형 표현을 잡는다', () => {
    const violations = findNewTextViolations(
      '더 이상 집착하지 마세요.',
      '지금 확인된 조건을 세어 보겠습니다.',
      'love-reunion'
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it('base 문구가 이미 걸리는 패턴은 모델 위반으로 세지 않는다', () => {
    /*
     * 재회 금지어표의 `probability` 규칙은 `%` 자체를 막는다. 오행 분포처럼
     * 결정론 base 가 정당하게 퍼센트를 쓰는 문장까지 모델 탓으로 돌리면
     * 정상 echo 가 거부된다. base 대비 새로 생긴 위반만 센다.
     */
    const same = '목 비중이 23.5%로 가장 높습니다.';
    expect(findNewTextViolations(same, same, 'love-reunion')).toEqual([]);
    expect(findNewTextViolations('재회 확률은 60%입니다.', same, 'love-reunion').length)
      .toBeGreaterThan(0);
  });

  it('재회 전용 금지어는 다른 상품에 걸지 않는다', () => {
    expect(findNewTextViolations('SNS 반응을 참고하세요.', '참고 문장입니다.', 'general-signature'))
      .toEqual([]);
  });

  it('상품과 무관한 고객 문장 금지 패턴은 전 상품에 걸린다', () => {
    expect(findNewTextViolations('AI가 정리한 내용입니다.', '정리한 내용입니다.', 'general-signature').length)
      .toBeGreaterThan(0);
  });
});

describe('영구 잠금 구간', () => {
  it('삭제 불가 문구가 들어 있는 필드를 잠금으로 판정한다', () => {
    expect(isPermanentlyLockedProse(REUNION_UNDELETABLE_COPY['readiness-not-probability'])).toBe(true);
    expect(isPermanentlyLockedProse(REUNION_UNDELETABLE_COPY['timeline-not-promise'])).toBe(true);
    expect(isPermanentlyLockedProse('평범한 해설 문장입니다.')).toBe(false);
  });

  it('{name} 슬롯이 실제 이름으로 치환된 문구도 잠금으로 판정한다', () => {
    const rendered = REUNION_UNDELETABLE_COPY['timeline-not-probability'].replace(/\{name\}/gu, '민준');
    expect(isPermanentlyLockedProse(rendered)).toBe(true);
  });

  it('base 에 있던 삭제 불가 문구가 사라지면 잡는다', () => {
    const expected = `${REUNION_UNDELETABLE_COPY['readiness-not-probability']} 아래에서 하나씩 보겠습니다.`;
    expect(findRemovedUndeletableCopy(expected, expected)).toEqual([]);
    expect(findRemovedUndeletableCopy('조건을 세어 보겠습니다.', expected).length).toBeGreaterThan(0);
  });
});

describe('상품별 모드', () => {
  it('재회운만 authored 로 열고 나머지는 현행 유지한다', () => {
    expect(proseGuardModeFor('love-reunion')).toBe('authored');
    expect(proseGuardModeFor('general-signature')).toBe('strict-echo');
    expect(proseGuardModeFor('past-life-goblin')).toBe('strict-echo');
  });
});
