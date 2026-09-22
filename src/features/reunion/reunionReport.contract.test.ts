import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  REUNION_CHAPTER_IDS,
  REUNION_UNDELETABLE_COPY_IDS,
  findReunionBannedPhrases
} from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';
import { buildReunionChapterEvidence, formatReunionDayunLabel } from './reportEvidence';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

const view = () => read('./ReunionReportView.tsx');
const cuts = () => read('./reunionReportCuts.tsx');
const meters = () => read('./reunionMeters.tsx');
const landing = () => read('./ReunionLanding.tsx');
const sheet = () => read('../../styles/reunion-report.css');

/**
 * love-reunion 리포트가 뷰에 도달할 때 남아 있는 섹션 여섯 개를 그대로 본뜬 픽스처.
 * `Report.tsx:6096 buildReunionProductReport` 가 sections 를 갈아 끼우고
 * `preserveEngineEvidence` 가 `-v2` 네 개를 되살린 뒤의 실제 모양이다.
 * 일부러 **엔진이 실제로 흘리는 내부 식별자**를 섞어 두었다.
 */
function makeDeliveredReport(): SajuReportData {
  return {
    currentDayun: {
      name: '乙巳',
      range: '30세 ~ 39세',
      summary: '',
      focus: '',
      caution: '',
      startsAt: '2023-03-31T00:00:00.000Z',
      endsAt: '2033-03-31T00:00:00.000Z'
    },
    summary: {
      title: '요약',
      analysis: ['지금은 감정의 잔량보다 조건이 만들어졌는지가 핵심입니다.', '거리 조절이 먼저입니다.'],
      advice: ['첫 연락은 짧게 남기세요.', '여러 번 보내고 싶은 날에는 보내지 않는 편이 낫습니다.']
    },
    keyTakeaways: [
      { title: '재회 핵심', body: '감정이 남았는지보다 조건이 생겼는지가 중요합니다.' },
      { title: '연락', body: '긴 설명보다 안부와 짧은 확인 하나가 더 안전합니다.' }
    ],
    sections: [
      {
        id: 'calculation-audit-v2',
        title: '계산 기준',
        paragraphs: ['입력값과 적용한 달력 정책을 함께 기록했습니다.', '시간 보정은 본인 쪽에만 적용했습니다.'],
        bullets: ['양력 기준으로 환산했습니다.', '자시 경계는 자정으로 두었습니다.']
      },
      {
        id: 'expert-evidence-v2',
        title: '월령·조후·용신 근거',
        paragraphs: ['월령을 먼저 보고 강약을 정했습니다.', '조후는 두 번째 기준입니다.', '세 번째 문단.'],
        cards: [
          { title: '월령 판정', body: '가을 금 기운이 우세한 자리에서 태어났습니다.' },
          { title: '강약 판정', body: '통근이 약해 도움 오행을 먼저 봅니다.' }
        ],
        details: [
          { summary: '월령 근거', content: '월지 기준으로 강약을 먼저 갈랐습니다.\n\n근거 ID: MRE-1, MRE-2' },
          { summary: '조후 근거', content: '건조한 편이라 물 기운을 먼저 봅니다.' },
          { summary: '용신 근거', content: '도움 오행을 두 가지로 좁혔습니다.' },
          { summary: '병약 근거', content: '막히는 자리를 하나 짚었습니다.' }
        ]
      },
      {
        id: 'temporal-evidence-v2',
        title: '원국 × 대운 × 세운 × 월운',
        paragraphs: ['흐름은 네 층을 겹쳐 봅니다.', '두 번째 문단.'],
        details: [
          { summary: '대운 층', content: '이 구간은 기준을 다듬는 흐름입니다.' },
          { summary: '세운 층', content: '올해는 결정을 미루는 편이 낫습니다.' },
          { summary: '월운 층', content: '달마다 여력이 달라집니다.' },
          { summary: '겹침', content: '세 층이 같은 방향일 때만 강하게 읽습니다.' }
        ]
      },
      {
        id: 'compatibility-evidence-v2',
        title: '두 사람 정밀 궁합 근거',
        paragraphs: [
          '보완과 마찰 근거가 함께 있어 조건부 관계로 해석합니다.',
          '두 일간은 반응 방식의 공통점이 큽니다.',
          '두 배우자궁 사이에 마찰 관계가 함께 존재합니다.',
          '상호 오행 공급은 personA 기준 supportive, personB 기준 mixed입니다.'
        ],
        cards: [
          { title: '초기 끌림과 반응성', body: '조정 압력이 우세합니다.', badge: '조정이 필요한 흐름' },
          { title: '감정 교류의 흐름', body: '방향성이 중립적입니다.', badge: '조건을 함께 봐야 합니다' },
          { title: '표현과 의사소통', body: '방향성이 중립적입니다.', badge: '조건을 함께 봐야 합니다' },
          { title: '관계 지속과 회복', body: '방향성이 중립적입니다.', badge: '조건을 함께 봐야 합니다' }
        ],
        details: [
          { summary: 'day-master · mixed', content: '두 일간이 같은 기운입니다.\n\n근거 ID: rel-1' },
          { summary: 'spouse-palace · 조정이 필요한 흐름', content: '두 배우자궁이 부딪힙니다.' },
          { summary: 'element-exchange · 조화를 돕는 흐름', content: '한쪽 공급이 우세합니다.' },
          { summary: 'element-exchange · mixed', content: 'personA 원국이 personB에게 공급합니다.' },
          { summary: 'relation-pattern · 조화를 돕는 흐름', content: '반복 패턴이 하나 잡힙니다.' }
        ]
      },
      {
        id: 'reunion-core',
        title: '재회운 핵심 진단',
        cards: [
          { title: '남은 감정', body: '감정이 남아 있어도 바로 이어진다고 볼 수는 없습니다.' },
          { title: '연락하기 좋은 조건', body: '짧은 안부와 사실 확인을 할 수 있을 때가 더 안전합니다.' },
          { title: '멈춰야 할 신호', body: '연속 메시지를 보내고 싶어질 때는 아직 타이밍이 아닙니다.' },
          { title: '첫 연락 원칙', body: '안부와 짧은 확인 하나만 남기는 편이 좋습니다.' }
        ]
      },
      {
        id: 'reunion-timeline',
        title: '재접촉 타이밍',
        details: [
          { summary: '2026.09 · 보통', content: '결론을 서두르지 않는 구간입니다.' },
          { summary: '2026.10 · 좋음', content: '가벼운 접점을 열어볼 수 있는 구간입니다.' },
          { summary: '2026.11 · 보통', content: '반응을 보되 결론을 미루는 구간입니다.' }
        ]
      }
    ]
  } as unknown as SajuReportData;
}

describe('reunion report screen contract', () => {
  /* ── 근거 선별 ─────────────────────────────────────────── */

  it('fills every chapter from the six sections that actually reach the view', () => {
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());

    expect(Object.keys(evidence).sort()).toEqual([...REUNION_CHAPTER_IDS].sort());
    REUNION_CHAPTER_IDS.forEach((id) => {
      expect(evidence[id].entries.length, `${id} has no evidence`).toBeGreaterThan(0);
      expect(evidence[id].title).toBeTruthy();
      expect(evidence[id].note).toBeTruthy();
    });
  });

  it('never shows an engine identifier or an internal line to the reader', () => {
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());
    const text = REUNION_CHAPTER_IDS.map((id) =>
      evidence[id].entries.map((entry) => `${entry.label} ${entry.body}`).join(' ')
    ).join(' ');

    // v2/compatibility/engine.ts:477-497 의 personA/personB 누출은 화면에서 버린다.
    expect(text).not.toMatch(/person[AB]/u);
    for (const token of [
      'day-master',
      'spouse-palace',
      'element-exchange',
      'relation-pattern',
      'supportive',
      'mixed',
      'insufficient',
      '근거 ID'
    ]) {
      expect(text, `leaked ${token}`).not.toContain(token);
    }
  });

  it('keeps age notation out of every evidence line', () => {
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());
    REUNION_CHAPTER_IDS.forEach((id) => {
      evidence[id].entries.forEach((entry) => {
        expect(`${entry.label} ${entry.body}`).not.toMatch(/\d{1,3}\s*세(?![기대])/u);
      });
    });
  });

  it('never repeats the same engine passage in two chapters', () => {
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());
    const bodies = REUNION_CHAPTER_IDS.flatMap((id) => evidence[id].entries.map((entry) => entry.body));
    expect(new Set(bodies).size).toBe(bodies.length);
  });

  /* ── 대운 표기 ─────────────────────────────────────────── */

  it('prints the calculated dayun years, never an age and never a guessed year', () => {
    const report = makeDeliveredReport();
    /* 엔진이 실제로 내는 경계. 나이 문자열(`30세 ~ 39세`)은 생년 + 시작 나이로 되짚으면
       2022~2031 이 되지만 실제 구간은 2023~2033 이다. 계산된 경계만 쓴다. */
    expect(formatReunionDayunLabel(report)).toBe('乙巳 대운 · 2023 ~ 2033');
    expect(formatReunionDayunLabel(report)).not.toMatch(/\d{1,3}\s*세(?![기대])/u);

    // 경계가 없으면 연도를 지어내지 않고 간지만 남긴다.
    const noBoundary = makeDeliveredReport();
    noBoundary.currentDayun = { ...noBoundary.currentDayun, startsAt: undefined, endsAt: undefined };
    expect(formatReunionDayunLabel(noBoundary)).toBe('乙巳 대운');
  });

  /* ── 컷 렌더러 ─────────────────────────────────────────── */

  it('draws every payload kind the deterministic layer can emit', () => {
    const types = read('../../lib/reunion/reportTypes.ts');
    const union = types.slice(
      types.indexOf('export type ReunionCutPayload ='),
      types.indexOf('export interface ReunionCut {')
    );
    const declared = Array.from(union.matchAll(/kind: '([A-Za-z0-9-]+)'/gu), (match) => match[1]);
    const handled = cuts();

    expect(declared.length).toBeGreaterThan(15);
    declared.forEach((kind) => {
      expect(handled, `no case for ${kind}`).toContain(`case '${kind}':`);
    });
  });

  it('gives beat cuts a height and nothing else', () => {
    expect(cuts()).toContain("cut.layout === 'beat'");
    expect(cuts()).toContain('rr-cut rr-cut--beat');
  });

  it('keeps the two captions the spec pins below their panel out of the lead set', () => {
    const source = cuts();
    const leadSet = /const CAPTION_ABOVE = new Set\(\[([^\]]*)\]\)/u.exec(source);

    expect(leadSet).toBeTruthy();
    expect(leadSet?.[1]).not.toContain('readiness');
    expect(leadSet?.[1]).not.toContain('timeline12');
    expect(leadSet?.[1]).not.toContain('deadline-input');
  });

  /* ── 안전 계약 ─────────────────────────────────────────── */

  it('renders no purchase or next-product block when the gate defers', () => {
    const source = view();
    const at = source.indexOf('payload.allowPurchaseCta');

    expect(at, 'recommendations are not gated on allowPurchaseCta').toBeGreaterThan(-1);
    // 추천 블록이 그 조건 안에 있어야 한다.
    expect(source.slice(at, at + 400)).toContain('rr-next');
  });

  it('collapses the remaining chapters when the gate defers', () => {
    const source = view();
    expect(source).toContain("payload.gate.state === 'deferred'");
    expect(source).toContain('rr-collapsed');
  });

  it('writes no banned phrase in any screen-owned string', () => {
    /* 주석은 뺀다 — 주석에는 `30세 ~ 39세` 같은 **금지 사유 설명**이 들어 있고,
       그것까지 금지하면 왜 금지인지 적을 수가 없다. 검사 대상은 화면에 나가는 문자열뿐이다. */
    const stripComments = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');

    const sources = [view(), cuts(), meters(), read('./reportEvidence.ts')];
    const hits: string[] = [];

    sources.forEach((source) => {
      const literals = stripComments(source).match(/(['"`])(?:\\.|(?!\1)[^\\])*\1/gu) || [];
      literals
        .map((literal) => literal.slice(1, -1))
        .filter((text) => /[가-힣]/u.test(text))
        .forEach((text) => {
          findReunionBannedPhrases(text).forEach((hit) => hits.push(`${hit.ruleId}: ${text}`));
        });
    });

    expect(hits, hits.join(' | ')).toEqual([]);
  });

  it('marks undeletable cuts in the DOM so a redesign cannot quietly drop them', () => {
    expect(cuts()).toContain('data-undeletable={cut.undeletableCopyId || undefined}');
    expect(REUNION_UNDELETABLE_COPY_IDS.length).toBe(7);
  });

  /* ── 계측 프리미티브 재사용 ────────────────────────────── */

  it('shares one gauge/band/timeline/tally implementation with the landing page', () => {
    const shared = meters();

    for (const name of [
      'ReunionMeterGauge',
      'ReunionMeterBand',
      'ReunionMeterTimeline',
      'ReunionMeterTally'
    ]) {
      expect(shared, `${name} is not exported from reunionMeters`).toContain(`export function ${name}`);
      expect(landing(), `landing does not use ${name}`).toContain(name);
    }

    expect(cuts()).toContain('ReunionMeterGauge');
    expect(cuts()).toContain('ReunionMeterBand');
    expect(cuts()).toContain('ReunionMeterTally');
    expect(cuts()).toContain('ReunionMeterTimeline');

    // 랜딩이 자기 마크업을 다시 손으로 쓰고 있으면 두 화면의 문법이 갈라진다.
    expect(landing()).not.toContain('className="rw-gauge-track"');
    expect(landing()).not.toContain('className="rw-band-ticks"');
    expect(landing()).not.toContain('className="rw-tally-num"');
    expect(landing()).not.toContain('className="rw-timeline-dot"');
  });

  /* ── 스타일 격리 ───────────────────────────────────────── */

  it('scopes every report rule under the report root', () => {
    const css = sheet().replace(/\/\*[\s\S]*?\*\//g, '');
    const selectors = Array.from(css.matchAll(/(^|\})\s*([^{}@]+)\{/gu), (match) => match[2].trim())
      .flatMap((group) => group.split(','))
      .map((part) => part.trim())
      .filter(Boolean);

    const stray = selectors.filter(
      (selector) => !/^(\.rr-|\.rr\b)/u.test(selector) && !selector.startsWith('.rr-page')
    );

    expect(stray, `unscoped selectors: ${stray.join(' | ')}`).toEqual([]);
  });

  it('never re-declares the shell container or paints html/body', () => {
    const css = sheet().replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toMatch(/app-container/u);
    expect(css).not.toMatch(/(^|[},])\s*(html|body)\s*[,{]/mu);
  });

  it('declares no motion of its own, and no blanket reduced-motion override', () => {
    /* 이 화면의 모션은 전부 reunion-premium.css 의 `ud-*` 패턴이다. 이 시트는
       한 줄도 선언하지 않으므로 감속 선호에서 끌 것도 없다.

       ★ 일괄 무력화(`animation-duration: 0.001ms !important`)를 두지 않는다.
       디자인 시스템이 금지한 방식이고(premium · webtoon · intake 세 시트의 계약이
       같은 것을 단정한다), '모션을 끈다' 가 아니라 '아주 짧게 재생한다' 여서
       최종 상태를 보장하지 못한다. 패턴마다 올바른 끝점이 다르기 때문에
       (호 게이지는 0 이 아니라 --ud-arc-rest 에 앉아야 한다) 소유한 시트가
       명시적으로 고정하는 방식만 옳다. */
    const css = sheet().replace(/\/\*[\s\S]*?\*\//g, '');

    expect(css).not.toMatch(/(^|[;{\s])animation\s*:/u);
    expect(css).not.toMatch(/(^|[;{\s])transition\s*:/u);
    expect(css).not.toMatch(/animation-duration:\s*0?\.0+\d*ms/u);
    expect(css).not.toMatch(/transition-duration:\s*0?\.0+\d*ms/u);
  });

  it('keeps a 16px side gutter and clips horizontal overflow', () => {
    const css = sheet();
    expect(css).toContain('--rr-gutter: 16px');
    expect(css).toContain('overflow-x: clip');
  });

  /* ── 검증에서 잡힌 결함의 회귀 잠금 ───────────────────────── */

  it('never cites the hardcoded reunion-core cards as the basis for a counted number', () => {
    /* CH03 아코디언이 `조건 개수는 이 자료 위에서 셌어요` 라는 제목을 달고
       `Report.tsx` 안에 통째로 하드코딩된 고정 산문 네 장을 근거로 내보내던 자리다.
       그 카드들은 모든 독자에게 글자 단위로 같고, 집계(`readiness.ts`)가 읽지도 않는다. */
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());
    const ch03 = evidence['contact-readiness'];
    const text = ch03.entries.map((entry) => `${entry.label} ${entry.body}`).join(' ');

    expect(text).not.toContain('남은 감정');
    expect(text).not.toContain('첫 연락 원칙');
    expect(ch03.note).not.toContain('이 자료 위에서 셌');
    // 계산으로 채운 칸의 실제 입력을 싣는다.
    expect(ch03.entries.length).toBeGreaterThan(0);
    expect(text).toContain('표현과 의사소통');
  });

  it('never classifies the same month twice inside CH04', () => {
    /* 차트는 12개 점수의 33/67 퍼센타일로 가르고, `reunion-timeline` 디테일은
       절대 임계값 75/55 로 `재회 적용: …` 문구를 만든다. 한 장에 둘을 함께 실으면
       같은 달이 서로 다른 기준으로 두 번 분류된다. */
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());
    const text = evidence['twelve-months'].entries.map((entry) => entry.body).join(' ');

    expect(evidence['twelve-months'].entries.length).toBeGreaterThan(0);
    expect(text).not.toContain('재회 적용');
  });

  it('renders undeletable cuts outside the fold, not inside a closed details', () => {
    /* 닫힌 <details> 안은 브라우저가 렌더하지 않아 접근성 트리에서도 사라진다.
       그대로 접으면 안전 문구가 **독자가 가장 취약하다고 판정된 바로 그 상태에서** 없어진다. */
    const source = view();
    expect(source).toContain('cut.undeletable');
    expect(source).toContain('alwaysOnCuts');

    // 접는 쪽에서 undeletable 컷을 빼고, 그 컷들을 <details> **앞에** 그린다.
    expect(source).toContain('Boolean(cut.undeletable)');
    expect(source).toContain('chapter.cuts.filter(staysOpen)');
    expect(source).toContain('chapter.cuts.filter((cut) => !staysOpen(cut))');
    // 판정을 만든 컨트롤(신호 판독표)도 그 판정으로 숨기지 않는다.
    expect(source).toContain("cut.payload?.kind === 'signal-table'");

    const fold = source.slice(source.indexOf('{collapsed ? ('));
    expect(fold.indexOf('alwaysOnCuts')).toBeGreaterThan(-1);
    expect(fold.indexOf('alwaysOnCuts')).toBeLessThan(fold.indexOf('<details className="rr-collapsed"'));
  });

  it('holds the reader-owned deadline caption until the reader actually types a date', () => {
    const source = cuts();
    expect(source).toContain('captionHeldForInput');
    expect(source).toContain("cut.payload?.kind === 'deadline-input' && !interactions.deadline");
    expect(source).toContain('beforeInputNote');
  });

  it('marks each counted condition as told-to-us or calculated', () => {
    /* 다섯 칸은 입력 3개와 계산 2개가 섞여 있다. 한 숫자로 합산하면서 ◇/◆ 를 지우면
       프롤로그에서 선언한 '섞지 않는다'가 같은 리포트 안에서 깨진다. */
    const source = cuts();
    const readinessBlock = source.slice(
      source.indexOf("case 'readiness'"),
      source.indexOf("case 'timeline12'")
    );
    expect(readinessBlock).toContain('<BasisMark basis={item.basis} />');
    expect(readinessBlock).toContain('formatReadinessBasisSplit');
  });

  it('gives each signal row its own fact/guess label instead of a hidden column head', () => {
    /* 열 머리글은 560px 미만에서 display:none 이고 aria-hidden 이라,
       모바일 사용자와 모든 스크린리더 사용자에게 사실/추측 구분이 전달되지 않았다. */
    const source = cuts();
    const block = source.slice(source.indexOf("case 'signal-table'"), source.indexOf("case 'readiness'"));
    expect(block).toContain('rr-signal-tag');
    expect(block).toContain('이건 사실 · ');
    expect(block).toContain('이건 추측 · ');
    // 빈 칸을 '—' 로 두면 여섯 행이 같은 글자를 반복해 읽힌다.
    expect(block).not.toContain(">'—'<");
  });

  it('paints the hold bar with a boundary the eye can find against its own track', () => {
    /* 보류 막대가 트랙과 같은 색이라 12칸 중 절반이 빈 자리로 읽혔다(1.4.11 미달). */
    const css = sheet();
    const hold = css.slice(css.indexOf('.rr-band-tick.is-hold'), css.indexOf('.rr-band-tick.is-marked'));
    expect(hold).not.toContain('rgba(36, 20, 20');
    expect(hold).toMatch(/box-shadow:[^;]*rgba\(201, 183, 159, 0\.8\d?\)/u);
  });

  it('keeps the reunion chapter and the letting-go chapter the same weight on screen', () => {
    /* 페이로드는 두 장을 컷 수·총 높이로 이미 같게 잠갔다(`reportPayload.test.ts`).
       화면이 근거 개수나 노드 문장 길이로 그 대칭을 깨면 분량 차이 자체가 권유가 된다(§1).
       연운 노드가 `summary`(간지 역학 서술, 십성 용어 포함)를 실으면 CH06 이 CH05 보다
       한 화면 가까이 길어진다 — 실측에서 22.6% 차이를 만들던 지점이다. */
    const evidence = buildReunionChapterEvidence(makeDeliveredReport());
    const five = evidence['repeat-risk'].entries.length;
    const six = evidence['other-door'].entries.length;
    expect(Math.abs(five - six)).toBeLessThanOrEqual(1);

    const block = cuts().slice(cuts().indexOf("case 'timelineYears'"));
    expect(block).toContain('note: cell.focus || cell.summary');
  });

  it('states which surface the small gold text was measured against', () => {
    const css = sheet();
    expect(css).toContain('--rr-gold-text: #a07d58');
    expect(css).toContain('--rr-ink-3(#241414)');
  });
});
