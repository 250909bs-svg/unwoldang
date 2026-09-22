/**
 * 엔티티 화이트리스트와 **귀속 검사** — 환각 차단의 실효 방어.
 *
 * ## 앞선 구현이 뚫린 지점 (검증 실측)
 *
 * 1. 한글 간지는 접미사가 **바로** 붙은 형태만 검사했다 → 9형태 중 6형태 통과.
 * 2. 합·충·형·파·신살·용신에 대응하는 계층이 **아예 없었다** → 지어낸 명리 근거
 *    12문장 전부 통과.
 * 3. 십이운성은 후행 부정 탐색 `(?![가-힣])` 때문에 조사가 붙으면(항상 붙는다)
 *    검출이 사라졌다 → `'제왕의 자리에'` · `'제왕입니다'` 통과.
 * 4. 십성 집합이 값 0 인 라벨까지 받아 10/10 이 들어와 완전한 no-op 이었다.
 * 5. 화이트리스트는 **집합 소속만** 보고 귀속을 못 봤다 → 일주 `무자` 인데
 *    `'일주는 임자로 읽었습니다'`, 도움 오행 `토·화` 인데 `'도움 오행은 수와 금'` 통과.
 *
 * 이 파일은 다섯 가지를 각각 거부 케이스로 고정하고, 동시에 **오탐 방지 케이스**를
 * 같은 비중으로 고정한다. 오탐은 필드를 조용히 base 로 되돌려 채택률만 깎는다.
 */

import { describe, expect, it } from 'vitest';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import {
  buildEntityUniverse,
  buildReportFactAnchors,
  findMisattributedClaims,
  findUnknownEntities
} from './geminiProseGuard';
import { findReunionIntentViolations } from './reunionIntentGuard';

const formData = {
  name: '검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'breakup-reunion' as const,
  partner: {
    name: '상대 검증자',
    gender: 'male' as const,
    calendar: 'solar' as const,
    isLeapMonth: false,
    birthDate: '1991-05-14',
    birthTime: '08:30',
    isUnknownTime: false
  },
  q1: '다시 연락해도 될까요?',
  q2: '답이 없으면 언제 멈춰야 하나요?'
};

const basis = buildDeterministicSajuBasis('love-reunion', formData);
const report = buildSajuReport('love-reunion', formData, basis);
const universe = buildEntityUniverse(basis, report);
const anchors = buildReportFactAnchors(basis, report);

const kinds = (text: string) => findUnknownEntities(text, universe).map((item) => item.kind);

describe('간지 — 표기 변형으로 우회할 수 없다', () => {
  /** 이 명식에 실재하지 않는 간지. 실재하면 이 파일의 전제가 무너지므로 먼저 확인한다. */
  it('테스트 전제: 갑자는 이 명식에 없다', () => {
    expect(universe.ganzhi.has('갑자')).toBe(false);
    expect(universe.ganzhi.has('무자')).toBe(true); // 실제 일주
  });

  const bypasses = [
    ['접미사 앞 공백', '갑자 년에는 흐름이 강해집니다.'],
    ['접미사 없음 + 후행 문맥', '갑자 흐름이 강하게 들어옵니다.'],
    ['후행 문맥(기운)', '갑자 기운이 들어옵니다.'],
    ['한자 천간 + 한글 지지', '甲자년에는 흐름이 강해집니다.'],
    ['한글 천간 + 한자 지지', '갑子년에는 흐름이 강해집니다.'],
    ['간지 사이 공백', '갑 자년에는 흐름이 강해집니다.'],
    ['선행 문맥', '올해 간지는 갑자입니다.'],
    ['접미사형(년)', '갑자년에 흐름이 바뀝니다.'],
    ['접미사형(대운)', '갑자대운으로 넘어갑니다.'],
    ['접미사형(일주)', '갑자일주로 읽습니다.']
  ] as const;

  bypasses.forEach(([label, text]) => {
    it(label, () => {
      expect(findUnknownEntities(text, universe), text)
        .toEqual([{ kind: 'ganzhi', token: '갑자' }]);
    });
  });

  it('한자 간지도 한글로 정규화해 한 값으로 모은다', () => {
    // 丙午 는 이 명식의 세운·월운 표에 실재하므로 통과한다. 표기 정규화는
    // 집합에 없는 값으로 확인한다.
    expect(universe.ganzhi.has('병오')).toBe(true);
    expect(findUnknownEntities('甲子 대운에 들어갑니다.', universe))
      .toEqual([{ kind: 'ganzhi', token: '갑자' }]);
  });
});

describe('간지 — 동형 일상어를 오탐하지 않는다', () => {
  /**
   * 명세의 출발 패턴은 `임신`·`무술`·`병자`·`신축`·`정오`·`기사`·`신사` 를 전부
   * '존재하지 않는 간지' 로 잡았다. 모델이 평범한 한국어를 썼다는 이유로 필드가
   * 조용히 base 로 되돌아가면, 검사가 있다는 사실 자체가 채택률만 깎는다.
   */
  const safe = [
    '임신 계획은 이 리포트에서 다루지 않아요.',
    '무술을 배우면 생활 리듬이 잡혀요.',
    '병자 취급하지 않아요.',
    '신축 건물로 이사하셔도 괜찮아요.',
    '정오 무렵에 잠깐 쉬어 가세요.',
    '기사에서 읽으신 내용과는 달라요.',
    '신사답게 굴었는지는 중요하지 않아요.',
    '갑자기 연락이 끊겼다고 하셨어요.',
    '3개월 뒤에 다시 보셔도 돼요.',
    '점검할 것이 3가지 있어요.'
  ];

  safe.forEach((text) => {
    it(text.slice(0, 22), () => {
      expect(kinds(text), text).not.toContain('ganzhi');
    });
  });
});

describe('지지 관계 — 지어낸 합충형파를 거부한다', () => {
  it('테스트 전제: 실재 관계는 집합에 있다', () => {
    expect(universe.relation.size).toBeGreaterThan(0);
    // 이 명식에는 자오충이 실재한다. 아래 오탐 방지 케이스의 근거다.
    expect(universe.relation.has('자오충')).toBe(true);
  });

  it('집합 밖의 관계 라벨을 거부한다', () => {
    // 인해합은 실재하는 육합이지만 **이 명식에는 없다.**
    expect(universe.relation.has('인해합')).toBe(false);
    expect(kinds('인해합이 걸려 있어 관계가 이어집니다.')).toContain('relation');
  });

  it('실재하는 관계를 서술한 문장은 통과한다', () => {
    expect(kinds('자오충이 있어 속도가 다를 때 마찰이 생깁니다.')).not.toContain('relation');
  });

  it('천간 관계 라벨도 같은 화이트리스트로 잡는다', () => {
    /*
     * 천간 합충도 엔진이 계산한다(`relations.ts:41-50` `stem-combination`/`stem-clash`).
     * 그래서 전량 금지가 아니라 **라벨 단위 화이트리스트**가 담당한다.
     * 실측으로 확인했다 — `temporal-evidence-v2` 가 `천간합`·`천간충` 을 정당하게 쓴다.
     */
    // 갑기합·무계합·병신합 은 이 명식에 실재한다. 없는 쌍으로 확인한다.
    expect(universe.relation.has('을경합')).toBe(false);
    expect(kinds('을경합이 성립해 관계가 이어집니다.')).toContain('relation');
    expect(universe.relation.has('갑경충')).toBe(false);
    expect(kinds('갑경충이 걸려 있습니다.')).toContain('relation');
  });

  /**
   * **관계 '종류' 토큰은 집합 소속만으로 못 막는다 — 남은 구멍이다.**
   *
   * `합`·`충`·`형`·`파`·`해`·`원진` 은 실재 관계에서 집합에 들어오므로,
   * 종류만 말하는 주장(`'천간합을 이루어'`)은 통과한다. 실효 방어는
   * **완성 라벨형**(위 케이스)이고, 그래서 라벨의 조사 허용이 결정적이다.
   * 이 한계를 테스트로 명시해 둔다 — 보고서에 "관계 주장을 전부 막는다" 고
   * 쓰지 않기 위해서.
   */
  it('종류만 말하는 주장은 이 계층으로 막히지 않는다 (알려진 한계)', () => {
    expect(kinds('두 분의 일주가 천간합을 이루어 다시 이어집니다.')).not.toContain('relation');
    // 다만 그 문장의 '다시 이어집니다' 쪽은 의도 가드가 잡는다.
    expect(findReunionIntentViolations('두 분의 일주가 천간합을 이루어 반드시 다시 이어집니다.', null)
      .map((hit) => hit.category)).toContain('unanchored-hope');
  });
});

describe('십이운성 — 조사가 붙어도 검출된다', () => {
  it('테스트 전제: 제왕은 이 명식에 없다', () => {
    expect(universe.twelveStage.has('제왕')).toBe(false);
  });

  const forms = [
    '제왕 자리에 있습니다.',
    '제왕의 자리에 있습니다.',
    '제왕입니다.',
    '제왕이고 흐름이 강합니다.',
    '장생의 구간입니다.',
    '목욕의 자리에 있습니다.'
  ];

  forms.forEach((text) => {
    it(text, () => {
      expect(kinds(text), text).toContain('twelveStage');
    });
  });

  it('한 글자 운성은 명시 문맥이나 국면어가 있을 때만 잡는다', () => {
    expect(kinds('십이운성으로는 절에 해당합니다.')).toContain('twelveStage');
    expect(kinds('지금은 절의 자리라 곧 풀립니다.')).toContain('twelveStage');
    expect(kinds('태의 국면이라 조용히 지나갑니다.')).toContain('twelveStage');
    expect(kinds('쇠의 구간이 시작됩니다.')).toContain('twelveStage');
  });

  it('한 글자 운성 동형 일상어는 오탐하지 않는다', () => {
    [
      '사람을 먼저 보세요.',
      '병원 다녀오신 뒤에 적어 두세요.',
      '양쪽 모두 괜찮아요.',
      '태도가 달라졌다고 하셨어요.',
      '묘한 기분이 드셨을 거예요.'
    ].forEach((text) => {
      expect(kinds(text), text).not.toContain('twelveStage');
    });
  });
});

describe('십성 — 집합 검사는 superset 이고 방어는 귀속 검사가 한다', () => {
  /**
   * **정직하게 적는다: 십성 집합 검사는 실효 방어가 아니다.**
   *
   * 정량 표(`{label:'편관', value:0}`)의 0 값 라벨은 집합에서 뺐지만, 결정론 산문
   * (`tenGodBasisNote` · `expert-evidence-v2` 등)이 십성 10개를 **정당하게 전부**
   * 언급하므로 집합은 다시 10/10 이 된다. 이것은 설계 원칙 (1)"집합은 관대하게" 의
   * 결과이고, 오거부를 막기 위해 필요한 동작이다.
   *
   * 그래서 "없는 십성을 지어낸다" 는 막히지 않는다 — 대신
   * **"없는 십성을 강하다고 주장한다" 를 귀속 검사가 막는다.** 아래 귀속 검사
   * 블록이 그 방어를 고정한다. 관측 보고에 "십성 검사가 막고 있다" 고 쓰면 안 된다.
   */
  it('0 값 라벨도 결정론 산문이 언급하면 집합에 들어온다', () => {
    const zeroLabels = report.tenGods.filter((item) => item.value === 0).map((item) => item.label);
    expect(zeroLabels.length).toBeGreaterThan(0);
    // 집합 소속만으로는 거부되지 않는다는 사실 자체를 고정한다.
    zeroLabels.forEach((label) => {
      expect(kinds(`${label}을 함께 봅니다.`), label).not.toContain('tenGod');
    });
  });
});

describe('귀속 검사 — 집합에 있어도 다른 자리의 값이면 거부한다', () => {
  it('테스트 전제: 실제 계산값', () => {
    expect(anchors.pillars.day).toBe('무자');
    expect(anchors.dayMasterStem).toBe('무');
    expect([...anchors.helpfulElements].sort()).toEqual(['토', '화']);
  });

  const cases: ReadonlyArray<readonly [string, string]> = [
    // 임자는 대운표에 있어 **집합을 통과한다.** 귀속 검사만 잡을 수 있다.
    ['일주는 임자로 읽었습니다.', '일주'],
    ['임자 일주로 봅니다.', '일주'],
    ['일간 병화는 감정을 먼저 꺼내는 자리예요.', '일간'],
    ['도움 오행은 수와 금이라 그 흐름을 쓰시면 좋아요.', '도움 오행'],
    ['용신은 목입니다.', '도움 오행']
  ];

  cases.forEach(([text, subject]) => {
    it(text.slice(0, 26), () => {
      const claims = findMisattributedClaims(text, anchors);
      expect(claims.map((claim) => claim.subject), text).toContain(subject);
    });
  });

  it('오행 극값을 뒤집어 말하면 거부한다', () => {
    // 실제 분포: 목 0 / 화 2 / 토 2 / 금 2 / 수 2 → 목이 가장 약하다.
    const claims = findMisattributedClaims('목 기운이 가장 강하고 화 기운이 가장 약합니다.', anchors);
    expect(claims.map((claim) => claim.subject)).toContain('가장 강한 오행');
    expect(claims.map((claim) => claim.subject)).toContain('가장 약한 오행');
  });

  it('없는 십성을 강하다고 주장하면 거부한다', () => {
    const zero = report.tenGods.find((item) => item.value === 0);
    expect(zero).toBeTruthy();
    const claims = findMisattributedClaims(`${zero!.label}이 매우 강해 압박을 먼저 받습니다.`, anchors);
    expect(claims.map((claim) => claim.subject)).toContain(`십성 ${zero!.label}`);
  });

  it('있는 십성을 없다고 주장하면 거부한다', () => {
    const present = report.tenGods.find((item) => item.value > 0);
    expect(present).toBeTruthy();
    const claims = findMisattributedClaims(`${present!.label}가 전혀 없어 관계 유지가 어렵습니다.`, anchors);
    expect(claims.map((claim) => claim.subject)).toContain(`십성 ${present!.label}`);
  });

  it('맞게 귀속한 문장은 통과한다', () => {
    expect(findMisattributedClaims('일주는 무자로 읽습니다.', anchors)).toEqual([]);
    expect(findMisattributedClaims('일간 무토는 결정의 중심이에요.', anchors)).toEqual([]);
    expect(findMisattributedClaims('도움 오행은 토와 화예요.', anchors)).toEqual([]);
    expect(findMisattributedClaims('목 기운이 가장 약합니다.', anchors)).toEqual([]);
  });

  it('귀속 서술어가 없는 문장은 검사 대상이 아니다', () => {
    /*
     * 이 검사는 **찾은 귀속 주장만** 본다. 위치 결속은 명세 §4-3 의 claim ledger 가
     * 들어와야 완성된다 — 남은 구멍임을 여기에 명시해 둔다.
     */
    expect(findMisattributedClaims('오늘은 조용히 지내 보세요.', anchors)).toEqual([]);
  });
});
