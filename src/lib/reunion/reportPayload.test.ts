import { describe, expect, it } from 'vitest';
import { reunionPanelImages } from '../../features/reunion/reunionPanelAssets';
import type { SajuReportData } from '../saju/report';
import { findLoveReunionSafetyViolations } from '../saju/reportBuilder';
import { findReunionBannedPhrases } from './bannedPhrases';
import { REUNION_BANNED_CHECK_EXEMPT_PAYLOAD_KINDS, buildReunionReportPayload } from './chapters';
import {
  REUNION_BUBBLE_SPEC,
  REUNION_NARRATION_SPEC,
  findReunionTextViolations
} from './glossary';
import {
  REUNION_CHAPTER_IDS,
  REUNION_SCENE_KEYS,
  type ReunionCut,
  type ReunionReportPayload
} from './reportTypes';
import { REUNION_UNDELETABLE_COPY_IDS } from './safetyCopy';
import { makeReunionContext, makeReunionSajuReport } from './testFixtures';

const NAME = '지윤';

function build(overrides: Partial<Parameters<typeof buildReunionReportPayload>[0]> = {}): ReunionReportPayload {
  return buildReunionReportPayload({
    report: makeReunionSajuReport(),
    context: makeReunionContext(),
    name: NAME,
    birthDate: '1994-03-12',
    ...overrides
  });
}

const allCuts = (payload: ReunionReportPayload): ReunionCut[] =>
  payload.chapters.flatMap((chapter) => [...chapter.cuts]);

describe('reunion report payload — structure', () => {
  it('always builds exactly the eight confirmed chapters, in order', () => {
    const payload = build();
    expect(payload.chapters).toHaveLength(8);
    expect(payload.chapters.map((chapter) => chapter.id)).toEqual([...REUNION_CHAPTER_IDS]);
    expect(payload.chapters.map((chapter) => chapter.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('titles every chapter as the reader’s own first-person question', () => {
    build().chapters.forEach((chapter) => {
      expect(chapter.questionTitle, chapter.id).toMatch(/^「.+」$/u);
      expect(chapter.questionTitle).not.toContain('{name}');
    });
  });

  it('gives every cut a unique id that the model can only match, never mint', () => {
    const payload = build();
    expect(new Set(payload.cutIds).size).toBe(payload.cutIds.length);
    expect(payload.cutIds).toEqual(allCuts(payload).map((cut) => cut.id));
  });

  it('numbers cuts from zero inside each chapter', () => {
    build().chapters.forEach((chapter) => {
      expect(chapter.cuts.map((cut) => cut.order)).toEqual(chapter.cuts.map((_cut, index) => index));
      chapter.cuts.forEach((cut) => expect(cut.chapterId).toBe(chapter.id));
    });
  });

  it('keeps the chapter height equal to the sum of its cuts', () => {
    build().chapters.forEach((chapter) => {
      expect(chapter.totalHeight).toBe(chapter.cuts.reduce((sum, cut) => sum + cut.height, 0));
    });
  });

  it('draws every scene from a panel key that actually exists on disk', () => {
    allCuts(build()).forEach((cut) => {
      if (cut.sceneKey === null) return;
      expect(REUNION_SCENE_KEYS, cut.id).toContain(cut.sceneKey);
      expect(Object.keys(reunionPanelImages), cut.id).toContain(cut.sceneKey);
    });
  });

  it('produces the same payload twice for the same input', () => {
    expect(build()).toEqual(build());
  });
});

describe('reunion report payload — CH05 / CH06 symmetry', () => {
  it('gives the reunion chapter and the letting-go chapter the same weight in every band', () => {
    (['neutral', 'teen', 'thirties', 'forties', 'fiftyPlus'] as const).forEach((ageBand) => {
      const payload = build({ ageBand });
      const repeat = payload.chapters[5];
      const other = payload.chapters[6];
      expect(repeat.cuts.length, ageBand).toBe(other.cuts.length);
      expect(repeat.totalHeight, ageBand).toBe(other.totalHeight);
    });
  });

  it('never leaves the letting-go chapter behind a paywall', () => {
    const other = build().chapters[6];
    expect(other.cuts.every((cut) => cut.mask === 'none')).toBe(true);
  });
});

describe('reunion report payload — safety contract', () => {
  it('renders all seven undeletable strings in every payment and gate state', () => {
    const states = [
      build(),
      build({ context: makeReunionContext({ contactStatus: 'blocked' }) }),
      build({ report: makeReunionSajuReport({ withCompatibility: false }) }),
      build({ selfCheck: { sleep: 'unstable', meals: 'unstable', routine: 'unstable' } })
    ];

    states.forEach((payload, index) => {
      const ids = allCuts(payload)
        .map((cut) => cut.undeletableCopyId)
        .filter(Boolean);
      REUNION_UNDELETABLE_COPY_IDS.forEach((id) => {
        expect(ids, `state ${index} / ${id}`).toContain(id);
        expect(payload.undeletableCopy[id]).toBeTruthy();
        expect(payload.undeletableCopy[id]).not.toContain('{name}');
      });
    });
  });

  it('never masks a cut that carries an undeletable safety string', () => {
    allCuts(build()).forEach((cut) => {
      if (!cut.undeletableCopyId) return;
      if (cut.undeletableCopyId === 'timeline-not-promise' || cut.undeletableCopyId === 'safety-boundary') {
        expect(cut.mask, cut.id).toBe('none');
      }
      expect(cut.undeletable, cut.id).toBe(true);
    });
  });

  it('refuses the purchase CTA on every chapter for a deferred reader', () => {
    const payload = build({ context: makeReunionContext({ breakupDuration: 'under1m' }) });
    expect(payload.gate.state).toBe('deferred');
    expect(payload.allowPurchaseCta).toBe(false);
    expect(payload.chapters.every((chapter) => chapter.allowPurchaseCta === false)).toBe(true);
  });

  it('allows the CTA only when the gate is open', () => {
    const payload = build();
    expect(payload.gate.state).toBe('ok');
    expect(payload.chapters.every((chapter) => chapter.allowPurchaseCta)).toBe(true);
  });

  it('shows the stop-here cut only to a deferred reader', () => {
    expect(build().cutIds).not.toContain('c00-6');
    expect(build({ context: makeReunionContext({ contactStatus: 'blocked' }) }).cutIds).toContain('c00-6');
  });

  it('replaces the readiness gauge with a hold verdict when contact is withheld', () => {
    const payload = build({ context: makeReunionContext({ contactStatus: 'blocked' }) });
    expect(payload.cutIds).toContain('c03-8');
    const gauge = allCuts(payload).find((cut) => cut.id === 'c03-4');
    expect(gauge?.payload?.kind).toBe('readiness');
    expect(gauge?.payload?.kind === 'readiness' && gauge.payload.readiness.withheld).toBe(true);
    expect(build().cutIds).not.toContain('c03-8');
  });

  it('only offers observation items that are properties of a conversation that already happened', () => {
    const table = allCuts(build()).find((cut) => cut.payload?.kind === 'signal-table');
    expect(table).toBeDefined();
    const labels = table?.payload?.kind === 'signal-table' ? table.payload.items.map((item) => item.label) : [];
    expect(labels.length).toBeGreaterThan(0);
    const serialized = labels.join(' ');
    ['SNS', '스토리', '차단', '지인', '프로필', '온라인'].forEach((forbidden) => {
      expect(serialized, forbidden).not.toContain(forbidden);
    });
  });

  it('shrinks CH02 and CH05 with a stated reason instead of hiding them', () => {
    const payload = build({ report: makeReunionSajuReport({ withCompatibility: false }) });
    expect(payload.chapters[2].cuts.length).toBeGreaterThan(0);
    expect(payload.chapters[2].reducedReason).toContain('근거가 부족해');
    expect(payload.chapters[5].reducedReason).toContain('근거가 부족해');
    expect(payload.chapters[3].reducedReason).toBeNull();
  });
});

describe('reunion report payload — copy rules', () => {
  const payload = build();
  const cuts = allCuts(payload);

  it('keeps every bubble inside the 26 / 4 / 11 spec and free of myeongri terms', () => {
    cuts.forEach((cut) => {
      expect(cut.bubbles.length, cut.id).toBeLessThanOrEqual(REUNION_BUBBLE_SPEC.maxBubblesPerCut);
      cut.bubbles.forEach((bubble) => {
        if (bubble.kind === 'sfx') return;
        expect(findReunionTextViolations(bubble.text, REUNION_BUBBLE_SPEC), `${cut.id}: ${bubble.text}`).toEqual(
          []
        );
      });
    });
  });

  it('keeps every narration inside its own spec', () => {
    cuts.forEach((cut) => {
      if (!cut.narration) return;
      expect(findReunionTextViolations(cut.narration, REUNION_NARRATION_SPEC), cut.id).toEqual([]);
    });
  });

  it('keeps myeongri terms out of cut dialogue and inside evidence badges only', () => {
    cuts.forEach((cut) => {
      cut.evidenceBadges.forEach((badge) => {
        expect(badge.translation, cut.id).toBeTruthy();
        expect(badge.translation).not.toContain(badge.term);
        expect(badge.claimRefs.length).toBeGreaterThan(0);
      });
    });
  });

  it('writes no banned phrase anywhere in the generated copy', () => {
    cuts.forEach((cut) => {
      if (cut.copyExemption) return;
      if (cut.payload && REUNION_BANNED_CHECK_EXEMPT_PAYLOAD_KINDS.includes(cut.payload.kind)) return;
      const copy = [cut.narration, cut.caption, ...cut.bubbles.map((bubble) => bubble.text)]
        .filter(Boolean)
        .join('\n');
      expect(findReunionBannedPhrases(copy, payload.ageBand), `${cut.id}: ${copy}`).toEqual([]);
    });
  });

  it('carries exactly one cut that quotes a banned phrase in order to refuse it', () => {
    const exempt = cuts.filter((cut) => cut.copyExemption);
    expect(exempt).toHaveLength(1);
    expect(exempt[0].id).toBe('c06-6');
    expect(exempt[0].narration).toContain('하지 않을게요');
  });

  it('never prints the reader’s age or generation in anything that reaches the screen', () => {
    /* `bannedPhrases` 는 모델에게 넘기는 기계용 목록이라 금지어 자체를 담고 있다 — 화면에 가는 것만 본다. */
    const rendered = JSON.stringify(payload.chapters);
    expect(rendered).not.toMatch(/\d{1,3}\s*세(?![기대])/u);
    expect(rendered).not.toContain('연령');
    expect(rendered).not.toContain('또래');
  });

  it('leaves no unsubstituted name slot behind', () => {
    expect(JSON.stringify(payload.chapters)).not.toContain('{name}');
    expect(JSON.stringify(payload.undeletableCopy)).not.toContain('{name}');
  });

  it('keeps every prohibited action as the superior rule, in measured wording', () => {
    const prohibited = cuts.find((cut) => cut.payload?.kind === 'prohibited');
    const items = prohibited?.payload?.kind === 'prohibited' ? prohibited.payload.items : [];
    const joined = items.join(' ');

    /* 금지 대상은 한 줄도 빠지지 않는다. 문안만 계량 서술로 다듬는다 —
       훈계형이 아니라 무슨 일이 일어나는지로 적는 것이 §6-E 의 요구다. */
    expect(joined).toContain('친구나 가족을 통해 반응을 확인하면');
    expect(joined).toContain('온라인 상태나 SNS 반응을 동의로 읽으면');
    expect(joined).toContain('운세 결과를 근거로');
    expect(joined).toContain('같은 내용을 두 번째');
    // 네 줄 모두 '~하면 ~됩니다/집니다' 꼴이라 목록 안에서 어형이 섞이지 않는다.
    items.forEach((item) => expect(item, item).toMatch(/니다$/u));
  });

  it('repeats the opening line exactly once, at the very end', () => {
    const occurrences = cuts.filter(
      (cut) =>
        cut.narration === '이상한 거 아니에요.' ||
        cut.bubbles.some((bubble) => bubble.text === '이상한 거 아니에요.')
    );
    expect(occurrences).toHaveLength(2);
    expect(occurrences[0].id).toBe('c00-2');
    expect(occurrences[1].id).toBe('c07-6');
  });
});

describe('reunion report payload — band branching', () => {
  it('changes only vocabulary, expansions and default-open chapters — never the chapter list', () => {
    const neutral = build({ ageBand: 'neutral' });
    const forties = build({ ageBand: 'forties' });
    expect(forties.chapters.map((chapter) => chapter.id)).toEqual(neutral.chapters.map((chapter) => chapter.id));
    expect(forties.chapters.map((chapter) => chapter.cuts.length)).toEqual(
      neutral.chapters.map((chapter) => chapter.cuts.length)
    );
  });

  it('opens the two chapters the band table names and leaves the rest present but folded', () => {
    const payload = build({ ageBand: 'forties' });
    const expanded = payload.chapters.filter((chapter) => chapter.expandedByDefault).map((chapter) => chapter.index);
    expect(expanded.sort()).toEqual([4, 5]);
    expect(payload.chapters.every((chapter) => chapter.cuts.length > 0)).toBe(true);
  });

  it('adds the affected-people framing only for the bands that ask for it', () => {
    const forties = allCuts(build({ ageBand: 'forties' })).find((cut) => cut.id === 'c05-5');
    const neutral = allCuts(build({ ageBand: 'neutral' })).find((cut) => cut.id === 'c05-5');
    expect(forties?.bandBlockId).toBe('not-only-for-them');
    expect(neutral?.bandBlockId).toBeUndefined();
    expect(forties?.height).toBe(neutral?.height);
  });

  it('serializes the band-aware banned phrase list for the prompt', () => {
    expect(build({ ageBand: 'forties' }).bannedPhrases).toContain('전남친');
    expect(build({ ageBand: 'thirties' }).bannedPhrases).toContain('아직 젊다');
  });

  it('derives the band from the birth date and the report createdAt, never from the clock', () => {
    expect(build().ageBand).toBe('thirties');
    expect(build({ birthDate: null }).ageBand).toBe('neutral');
  });
});

/* ────────────────────────────────────────────────────────────────
   검증에서 잡힌 결함의 회귀 잠금.
   각 테스트는 '무엇이 잘못됐었는지'를 먼저 적는다 — 고친 이유가 지워지면 같은 결함이 돌아온다.
   ──────────────────────────────────────────────────────────────── */

const cutOf = (payload: ReunionReportPayload, id: string) =>
  allCuts(payload).find((cut) => cut.id === id);

describe('reunion report payload — no uncalculated claim', () => {
  it('reads CH01 self-pattern copy off the top ten god instead of a fixed sentence', () => {
    /* 고정 문장을 쓰면 모든 독자가 같은 성향 판정을 받고, 그 옆에 붙는 십성 배지(계산값)가
       근거 없는 문장을 근거 있는 판정처럼 보이게 만든다. 두 층이 반대를 말하는 경우도 생긴다. */
    const sanggwan = build();
    const jeonggwan = build({
      report: makeReunionSajuReport({ tenGods: [{ label: '정관', value: 4 }] })
    });

    const bubbleOf = (payload: ReunionReportPayload) => cutOf(payload, 'c01-5')?.bubbles[0]?.text || '';
    const captionOf = (payload: ReunionReportPayload) => cutOf(payload, 'c01-6')?.caption || '';

    expect(bubbleOf(sanggwan)).not.toBe(bubbleOf(jeonggwan));
    expect(captionOf(sanggwan)).not.toBe(captionOf(jeonggwan));
    expect(captionOf(sanggwan)).toContain('직설');
    expect(captionOf(jeonggwan)).toContain('규칙과 책임');

    // 캡션과 배지는 같은 상위 십성에서 나온다.
    expect(cutOf(jeonggwan, 'c01-6')?.evidenceBadges[0]?.term).toBe('정관');
  });

  it('withholds the CH01 self-pattern sentence when there is no ten-god evidence', () => {
    const blank = build({ report: makeReunionSajuReport({ tenGods: [] }) });
    expect(cutOf(blank, 'c01-6')?.caption).toContain('비워 둬요');
    expect(cutOf(blank, 'c01-6')?.evidenceBadges).toHaveLength(0);
  });

  it('derives the CH05 repeat table from the continuity axis, never from a claimed past', () => {
    /* 좌열이 '말이 길어지면 한쪽이 멈췄다' 처럼 독자의 과거를 사실로 단정하고
       가운데 열이 '다시 멈춥니다' 로 재발을 단정하던 자리다. 어느 쪽도 계산되지 않았다. */
    const rowsOf = (payload: ReunionReportPayload) => {
      const cut = cutOf(payload, 'c05-3');
      return cut?.payload?.kind === 'compare3' ? cut.payload.rows : [];
    };

    const conditional = rowsOf(build());
    const tension = rowsOf(build({ report: makeReunionSajuReport({ continuityTendency: 'tension' }) }));
    const none = rowsOf(build({ report: makeReunionSajuReport({ withCompatibility: false }) }));

    expect(conditional).not.toEqual(tension);
    expect(conditional.flat().join(' ')).not.toContain('멈췄다');
    expect(tension.flat().join(' ')).not.toContain('의미를 붙였다');
    // 근거가 없으면 단정하지 않는다.
    expect(none.flat().join(' ')).toContain('보류');
  });

  it('gives every open month the same conditions instead of rotating an array', () => {
    /* 구간별로 다른 조건을 붙이면 계산되지 않은 구간별 차이를 만들어 낸 것이 된다. */
    const chart = cutOf(build(), 'c04-2');
    const cells = chart?.payload?.kind === 'timeline12' ? chart.payload.cells : [];
    const openCells = cells.filter((cell) => cell.label === 'open');

    expect(openCells.length).toBeGreaterThan(1);
    openCells.forEach((cell) => expect(cell.conditions).toEqual(openCells[0].conditions));
  });

  it('carries the full condition card, not a bare label, into CH03', () => {
    /* 캡션은 '조건 · 지금 상태 · 채우는 방법 세 줄'을 약속하는데 payload 가 라벨 한 줄만 실었다. */
    const cut = cutOf(build({ context: makeReunionContext({ lastContactAt: undefined }) }), 'c03-5');
    expect(cut?.payload?.kind).toBe('condition-cards');
    if (cut?.payload?.kind !== 'condition-cards') throw new Error('unreachable');

    expect(cut.payload.items.length).toBeGreaterThan(0);
    cut.payload.items.forEach((item) => {
      expect(item.reason).toBeTruthy();
      expect(item.howToFill).toBeTruthy();
      expect(item.basis === 'input' || item.basis === 'calculated').toBe(true);
    });
    // 미확인 조건이 0개인 독자에게는 '확정되지 않았다'가 아니라 '없다'고 적는다.
    expect(cut.payload.emptyLabel).toContain('없어요');
  });
});

describe('reunion report payload — safety branches', () => {
  it('defers the whole report when the reader marks a stated refusal', () => {
    /* 구두 거절은 contactStatus 로 들어오지 않는다. 이 한 칸을 수집만 하고 버리면
       상대가 그만 연락하라고 말한 뒤에도 연락 설계가 그대로 남는다. */
    const open = build();
    const refused = build({ observedSignals: { 'refusal-stated': true } });

    expect(open.gate.state).toBe('ok');
    expect(refused.gate.state).toBe('deferred');
    expect(refused.allowPurchaseCta).toBe(false);
    expect(refused.gate.hardReasons.join(' ')).toContain('거절이나 중단 요청');

    const gauge = cutOf(refused, 'c03-4');
    if (gauge?.payload?.kind !== 'readiness') throw new Error('unreachable');
    expect(gauge.payload.readiness.withheld).toBe(true);
    expect(gauge.payload.readiness.items.find((item) => item.id === 'no-refusal')?.state).toBe('unmet');

    // CH04 가 여전히 유리 구간을 권하면 게이트가 무력해진다.
    expect(cutOf(refused, 'c04-3')?.caption).toContain('구간을 따로 짚지 않아요');
  });

  it('drops timing advice to record-only whenever the gate defers', () => {
    const recordOnly = build({ context: makeReunionContext({ breakupDuration: 'under1m' }) });
    expect(recordOnly.gate.state).toBe('deferred');

    const conditions = cutOf(recordOnly, 'c04-4');
    expect(conditions?.payload?.kind === 'checklist' ? conditions.payload.items : null).toEqual([]);
    expect(conditions?.caption).toContain('연락 조건을 설계하지 않아요');

    const deadline = cutOf(recordOnly, 'c04-8');
    expect(deadline?.payload?.kind === 'deadline-input' ? deadline.payload.suggestion : 'x').toBeNull();

    expect(cutOf(recordOnly, 'c05-4')?.caption).toContain('적어 두는 칸');

    /* 12개월 표는 삭제 불가 캡션을 싣고 있어 보류 판정에서도 접히지 않는다.
       그래서 라벨이 `말문 열기 나음` 이면 게이트를 우회해 시기 권유가 남는다. */
    const chart = cutOf(recordOnly, 'c04-2');
    const labels = chart?.payload?.kind === 'timeline12' ? chart.payload.labels : null;
    expect(labels?.open).not.toContain('말문');
    expect(cutOf(build(), 'c04-2')?.payload).toMatchObject({
      labels: { open: '말문 열기 나음' }
    });
  });

  it('never labels a year in the letting-go chapter as a good time to reach out', () => {
    /* CH06 의 캡션은 '{이름}님 쪽 여력이 바뀌는 지점'이라고 말한다.
       같은 장의 노드가 `말문 열기 나음` 을 달면 캡션과 정면으로 어긋난다. */
    const years = cutOf(build(), 'c06-3');
    const labels = years?.payload?.kind === 'timelineYears' ? years.payload.labels : null;
    expect(labels?.open).toBe('여력이 도는 해');
    expect(Object.values(labels || {}).join(' ')).not.toContain('말문');
  });

  it('keeps the detour-contact prohibition for blocked and unknown contact', () => {
    /* `reportPresentation.ts:56` 이 blocked 분기에서만 붙이던 줄이다.
       차단 상황에서 가장 직접적인 스토킹 방지 항목이라 분기째로 승계한다. */
    const blocked = build({ context: makeReunionContext({ contactStatus: 'blocked' }) });
    const open = build();
    const itemsOf = (payload: ReunionReportPayload) => {
      const cut = cutOf(payload, 'c03-6');
      return cut?.payload?.kind === 'prohibited' ? cut.payload.items : [];
    };

    expect(itemsOf(blocked)[0]).toContain('다른 번호나 계정으로 우회 연락');
    expect(itemsOf(open).join(' ')).not.toContain('우회 연락');

    // 같은 분기를 CH07 에서 한 번 더 확인한다(§6-A).
    const legal = cutOf(blocked, 'c07-6');
    expect(legal?.payload?.kind === 'legal' ? legal.payload.boundaryNote : null).toContain('상대의 경계');
    const openLegal = cutOf(open, 'c07-6');
    expect(openLegal?.payload?.kind === 'legal' ? openLegal.payload.boundaryNote : 'x').toBeNull();
  });

  it('opens the letting-go chapter first and folds the reunion terms when harm signals appear', () => {
    const harm = build({ context: makeReunionContext({ notes: '자주 소리를 질렀고 무서웠어요.' }) });

    expect(harm.gate.harmSignalDetected).toBe(true);
    expect(harm.chapters.find((chapter) => chapter.id === 'other-door')?.expandedByDefault).toBe(true);

    const terms = cutOf(harm, 'c05-4');
    expect(terms?.payload?.kind === 'checklist' ? terms.payload.items : null).toEqual([]);
    expect(terms?.caption).toContain('합의 조건을 먼저 세우지 않아요');
  });

  it('lands a support line on the deferred-only cut while the contact channel is undecided', () => {
    const deferred = build({ context: makeReunionContext({ contactStatus: 'unknown' }) });
    expect(cutOf(deferred, 'c00-6')?.caption).toContain('믿을 만한 사람에게');
  });

  it('passes the engine hard guard on every context, so wiring the payload cannot break it', () => {
    /**
     * 이 카피 계층은 아직 `SajuReportData` 에 실리지 않아 `assertLoveReunionReportSafety` 의
     * 검사 대상 JSON 밖에 있다. 그래서 위반이 있어도 조용하다 —
     * 명세 §5 대로 배선하는 순간 love-reunion 전 건이 throw 로 떨어진다.
     * (실제로 '그 사람이 후회하는 …' 한 줄이 '상대 속마음 단정' 패턴에 걸려 있었다.)
     * 배선 전에 여기서 먼저 잡는다.
     */
    const contactStatuses = ['no-contact', 'occasional', 'active', 'blocked', 'unknown'] as const;
    const durations = ['under1m', 'oneTo3m', 'threeTo6m', 'sixTo12m', 'over1y', 'unknown'] as const;

    contactStatuses.forEach((contactStatus) => {
      durations.forEach((breakupDuration) => {
        const payload = build({ context: makeReunionContext({ contactStatus, breakupDuration }) });
        const violations = findLoveReunionSafetyViolations({
          serviceId: 'love-reunion',
          questionPreview: '',
          questionAnswers: [],
          reunionPayload: payload
        } as unknown as SajuReportData);

        expect(violations, `${contactStatus}/${breakupDuration}: ${violations.join(', ')}`).toEqual([]);
      });
    });
  });

  it('claims nothing about access that the product does not actually provide', () => {
    /* '여기까지는 결제 없이 읽으실 수 있어요' 는 독자가 즉시 반증할 수 있는 문장이었다 —
       이 뷰는 접근 게이트를 통과한 뒤에만 렌더된다. */
    const footers = build().chapters.map((chapter) => chapter.footerNote).join(' ');
    expect(footers).not.toContain('결제 없이');
    expect(footers).not.toContain('결제 상태와 관계없이');
  });
});
