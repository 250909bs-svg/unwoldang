import type {
  MatchCoupleGuidanceItem,
  MatchCouplePersonFacts,
  MatchCoupleReportModel
} from './types';

export const MATCH_COUPLE_CHAPTER_IDS = [
  'two-charts',
  'relations',
  'attraction',
  'emotional-expression',
  'communication',
  'conflict-recovery',
  'daily-life',
  'money',
  'long-term-roles',
  'cautions',
  'relationship-rules',
  'questions',
  'thirty-day-experiment'
] as const;

export const MATCH_COUPLE_STORY_CHAPTER_IDS = MATCH_COUPLE_CHAPTER_IDS;

export type MatchCoupleStoryChapterId = (typeof MATCH_COUPLE_CHAPTER_IDS)[number];

export const MATCH_COUPLE_STORY_ARTWORK_KEYS = [
  'dual-natal-portrait',
  'red-thread-interactions',
  'attraction-spark',
  'emotional-mirror',
  'message-bubbles',
  'conflict-repair',
  'shared-routine',
  'couple-ledger',
  'long-road-roles',
  'warning-fan',
  'relationship-contract',
  'question-oracle',
  'thirty-day-calendar'
] as const;

export type MatchCoupleStoryArtworkKey = (typeof MATCH_COUPLE_STORY_ARTWORK_KEYS)[number];

export interface MatchCoupleStoryChapter {
  id: MatchCoupleStoryChapterId;
  order: number;
  eyebrow: string;
  title: string;
  factBomb: string;
  statement: string;
  practicalRule: string;
  evidenceIds: readonly string[];
  uncertainty: readonly string[];
  artworkKey: MatchCoupleStoryArtworkKey;
}

interface StoryChapterMeta {
  id: MatchCoupleStoryChapterId;
  order: number;
  eyebrow: string;
  title: string;
  artworkKey: MatchCoupleStoryArtworkKey;
}

export const MATCH_COUPLE_STORY_CHAPTER_META: readonly StoryChapterMeta[] = [
  { id: 'two-charts', order: 1, eyebrow: 'CHAPTER 01 · 두 사람 원국', title: '둘 다 사랑법부터 다르다', artworkKey: 'dual-natal-portrait' },
  { id: 'relations', order: 2, eyebrow: 'CHAPTER 02 · 합충형파해', title: '붙는 힘과 부딪히는 힘', artworkKey: 'red-thread-interactions' },
  { id: 'attraction', order: 3, eyebrow: 'CHAPTER 03 · 끌림', title: '왜 이렇게 서로에게 꽂혔나', artworkKey: 'attraction-spark' },
  { id: 'emotional-expression', order: 4, eyebrow: 'CHAPTER 04 · 감정 표현', title: '사랑해도 표현법은 딴판', artworkKey: 'emotional-mirror' },
  { id: 'communication', order: 5, eyebrow: 'CHAPTER 05 · 연락과 대화', title: '답장 하나로 싸움 나는 이유', artworkKey: 'message-bubbles' },
  { id: 'conflict-recovery', order: 6, eyebrow: 'CHAPTER 06 · 갈등 회복', title: '싸운 뒤가 진짜 궁합이다', artworkKey: 'conflict-repair' },
  { id: 'daily-life', order: 7, eyebrow: 'CHAPTER 07 · 생활 습관', title: '같이 살면 여기서 티 난다', artworkKey: 'shared-routine' },
  { id: 'money', order: 8, eyebrow: 'CHAPTER 08 · 소비와 재물', title: '돈 얘기 피하면 더 크게 싸운다', artworkKey: 'couple-ledger' },
  { id: 'long-term-roles', order: 9, eyebrow: 'CHAPTER 09 · 장기 관계 역할', title: '오래 갈수록 역할이 보인다', artworkKey: 'long-road-roles' },
  { id: 'cautions', order: 10, eyebrow: 'CHAPTER 10 · 조심할 말과 행동', title: '이 말과 행동은 관계를 깎는다', artworkKey: 'warning-fan' },
  { id: 'relationship-rules', order: 11, eyebrow: 'CHAPTER 11 · 관계 유지 규칙', title: '둘이 지킬 최소 약속', artworkKey: 'relationship-contract' },
  { id: 'questions', order: 12, eyebrow: 'CHAPTER 12 · 질문 두 개', title: '둘이 진짜 묻고 싶었던 것', artworkKey: 'question-oracle' },
  { id: 'thirty-day-experiment', order: 13, eyebrow: 'CHAPTER 13 · 30일 관계 실험', title: '말보다 달라지는 마지막 약속', artworkKey: 'thirty-day-calendar' }
] as const;

const WITHHELD_FACT = '확인할 근거가 모자란 장면은 억지로 결론 내리지 않을게.';
const WITHHELD_STATEMENT = '두 사람의 안정된 원국이 모두 확인되지 않아 이 장면의 해석을 유보했어.';
const WITHHELD_RULE = '출생시간과 출생지역을 확인해 다시 계산하기 전에는 실제 대화와 행동 기록만 참고해.';
const MISSING_MODEL_NOTE = '궁합 리포트 모델이 없어 계산 근거를 표시할 수 없습니다.';

function unique(values: ReadonlyArray<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() || '').filter(Boolean))];
}

function getMeta(id: MatchCoupleStoryChapterId) {
  const meta = MATCH_COUPLE_STORY_CHAPTER_META.find((item) => item.id === id);
  if (!meta) throw new Error(`match-couple story metadata is missing: ${id}`);
  return meta;
}

function chapter(
  id: MatchCoupleStoryChapterId,
  content: Omit<MatchCoupleStoryChapter, keyof StoryChapterMeta>
): MatchCoupleStoryChapter {
  return { ...getMeta(id), ...content };
}

function modelUncertainty(model: MatchCoupleReportModel | null | undefined) {
  if (!model) return [MISSING_MODEL_NOTE];
  return unique([
    ...model.limitations,
    model.generatedFrom.compatibilityEngine === null
      ? '두 사람의 전체 궁합 계산이 유보되어 관계 차원의 결론을 표시하지 않았습니다.'
      : null
  ]);
}

function personUncertainty(person: MatchCouplePersonFacts | null, fallbackName: string) {
  if (!person) return [`${fallbackName}: 안정적으로 확정할 수 있는 원국이 없어 개인 해석을 유보했습니다.`];
  return unique([
    person.pillars.hour === null
      ? `${person.name}: 출생시간 미상으로 시주가 참여하는 항목을 제외했습니다.`
      : null,
    person.availability.status === 'available' ? null : person.availability.note
  ]);
}

function personStatement(person: MatchCouplePersonFacts | null, fallbackName: string) {
  if (!person) return `${fallbackName}: 안정된 연·월·일주를 확인하지 못해 원국 해석을 유보했어.`;
  const pillars = [
    person.pillars.year,
    person.pillars.month,
    person.pillars.day,
    person.pillars.hour || '시주 미상'
  ].join(' · ');
  const elements = person.fiveElements.map((item) => `${item.label} ${item.weight}`).join(', ');
  const tenGods = person.tenGods.map((item) => `${item.label} ${item.weight}`).join(', ');
  const palace = `${person.spousePalace.branch} · ${person.spousePalace.element} · ${person.spousePalace.tenGod}`;

  return `${person.name}: 원국 ${pillars}. 일간 ${person.dayMaster}(${person.dayMasterElement}), 오행 분포 ${elements}, 십신 분포 ${tenGods}, 배우자궁 ${palace}.`;
}

function twoChartsChapter(model: MatchCoupleReportModel | null | undefined) {
  const names: [string, string] = model?.names || ['본인', '상대방'];
  const self = model?.people[0] || null;
  const partner = model?.people[1] || null;
  let factBomb = '원국이 흔들리면 관계 결론도 같이 유보해야 해.';
  if (self && partner) {
    factBomb = self.dayMasterElement === partner.dayMasterElement
      ? `${self.name}와 ${partner.name}, 일간 오행은 모두 ${self.dayMasterElement}이지만 같은 오행도 관계 안의 역할은 다르게 드러날 수 있어.`
      : `${self.name}는 ${self.dayMasterElement}, ${partner.name}는 ${partner.dayMasterElement} 일간이라 같은 사건을 받아들이는 출발점이 다를 수 있어.`;
  }

  const overview = model?.overview;
  const relationship = model?.relationshipSummary
    ? `${model.relationshipSummary}. `
    : '';
  const overviewStatement = overview
    ? `관계 개요: ${overview.statement}`
    : '관계 개요는 안정된 두 원국이 모두 확인될 때까지 유보했어.';

  return chapter('two-charts', {
    factBomb,
    statement: `${relationship}${personStatement(self, names[0])} ${personStatement(partner, names[1])} ${overviewStatement}`,
    practicalRule: overview
      ? '상대의 반응을 내 방식의 정답에 맞추지 말고, 각자의 표현과 회복 방식을 따로 확인해.'
      : WITHHELD_RULE,
    evidenceIds: unique([
      ...(model?.evidenceIds.filter((id) => id.startsWith('person:')) || []),
      ...(overview?.evidenceIds || [])
    ]),
    uncertainty: unique([
      ...personUncertainty(self, names[0]),
      ...personUncertainty(partner, names[1]),
      ...(overview?.uncertainty || []),
      ...modelUncertainty(model)
    ])
  });
}

function relationsChapter(model: MatchCoupleReportModel | null | undefined) {
  const groups = model?.relations || [];
  const items = groups.flatMap((group) => group.items);
  const statement = groups.length
    ? groups.map((group) => {
      const details = group.items.length
        ? group.items.map((item) => `${item.subtype || item.name}: ${item.description}`).join(' / ')
        : '직접 근거 없음';
      return `${group.label}: ${details}`;
    }).join(' ')
    : WITHHELD_STATEMENT;

  return chapter('relations', {
    factBomb: !model
      ? WITHHELD_FACT
      : items.length
      ? `${items.length}개의 교차 근거가 잡혔어. 붙는 힘과 부딪히는 힘을 한 결론으로 섞지 마.`
      : '합충형파해의 직접 근거가 없다는 사실도 그대로 읽어야 해.',
    statement,
    practicalRule: !model
      ? WITHHELD_RULE
      : items.length
      ? '좋은 관계는 합만 세는 일이 아니라, 충·형·파·해가 나타나는 실제 장면에 대응 규칙을 붙이는 일이야.'
      : '직접 근거가 없을 때는 관계를 좋다거나 나쁘다고 확대하지 말고 실제 반복 행동을 기록해.',
    evidenceIds: unique(items.flatMap((item) => item.evidenceIds)),
    uncertainty: unique([
      ...items.flatMap((item) => item.uncertainty),
      ...modelUncertainty(model)
    ])
  });
}

function guidanceFactBomb(item: MatchCoupleGuidanceItem) {
  const copy = {
    supportive: '맞는 힘은 있어. 다만 장점도 둘이 반복할 때 관계의 습관이 돼.',
    conditional: '타고난 한 줄보다 둘이 합의한 운영 방식이 결과를 가른다.',
    tension: '사랑의 크기보다 방식의 충돌을 먼저 다뤄야 해.',
    insufficient: '확인된 근거가 부족한 부분은 실제 행동으로 다시 확인해야 해.'
  } as const;
  return `${item.label}: ${copy[item.tendency]}`;
}

function guidanceChapter(
  id: MatchCoupleStoryChapterId,
  item: MatchCoupleGuidanceItem | null | undefined,
  model: MatchCoupleReportModel | null | undefined
) {
  if (!item) {
    return chapter(id, {
      factBomb: WITHHELD_FACT,
      statement: WITHHELD_STATEMENT,
      practicalRule: WITHHELD_RULE,
      evidenceIds: [],
      uncertainty: unique([...modelUncertainty(model), WITHHELD_STATEMENT])
    });
  }

  return chapter(id, {
    factBomb: guidanceFactBomb(item),
    statement: item.statement,
    practicalRule: item.practicalRule,
    evidenceIds: unique(item.evidenceIds),
    uncertainty: unique([...item.uncertainty, ...modelUncertainty(model)])
  });
}

function cautionsChapter(model: MatchCoupleReportModel | null | undefined) {
  const words = model?.cautionWords || [];
  const actions = model?.cautionActions || [];
  const hasCautions = words.length > 0 || actions.length > 0;

  return chapter('cautions', {
    factBomb: hasCautions
      ? '상대를 고정하는 말과 답을 강요하는 행동은 갈등보다 오래 남아.'
      : WITHHELD_FACT,
    statement: hasCautions
      ? `조심할 말: ${words.join(' / ')}. 조심할 행동: ${actions.join(' / ')}.`
      : WITHHELD_STATEMENT,
    practicalRule: hasCautions
      ? '상대를 단정하는 문장이 나오면 사실·감정·요청을 각각 한 문장으로 다시 말해.'
      : WITHHELD_RULE,
    evidenceIds: unique(model?.evidenceIds || []),
    uncertainty: modelUncertainty(model)
  });
}

function rulesChapter(model: MatchCoupleReportModel | null | undefined) {
  const rules = model?.relationshipRules || [];
  return chapter('relationship-rules', {
    factBomb: rules.length
      ? `사랑을 오래 끄는 건 감정의 세기가 아니라 ${rules.length}개의 반복 가능한 약속이야.`
      : WITHHELD_FACT,
    statement: rules.length
      ? rules.map((rule, index) => `${index + 1}. ${rule}`).join(' ')
      : WITHHELD_STATEMENT,
    practicalRule: rules[0] || WITHHELD_RULE,
    evidenceIds: unique(model?.overview?.evidenceIds || []),
    uncertainty: modelUncertainty(model)
  });
}

function questionsChapter(model: MatchCoupleReportModel | null | undefined) {
  const questions = model?.questions || ['', ''];
  const complete = questions.every((question) => question.trim());
  return chapter('questions', {
    factBomb: complete
      ? '이 두 질문은 운세가 대신 결정할 문제가 아니라, 근거와 행동을 함께 확인할 문제야.'
      : '비어 있는 질문의 답을 대신 만들어 내지는 않을게.',
    statement: complete
      ? `QUESTION 1. ${questions[0]} QUESTION 2. ${questions[1]}`
      : '질문 두 개가 모두 확인되지 않아 질문 장면을 유보했어.',
    practicalRule: complete
      ? '답을 들을 때는 단정적인 결론보다 어떤 근거와 행동 기준이 붙었는지 확인해.'
      : '두 사람이 실제로 알고 싶은 질문을 한 문장씩 입력한 뒤 다시 확인해.',
    evidenceIds: unique(model?.overview?.evidenceIds || []),
    uncertainty: unique([
      ...modelUncertainty(model),
      complete ? null : '질문 두 개가 모두 필요합니다.'
    ])
  });
}

function experimentChapter(model: MatchCoupleReportModel | null | undefined) {
  const experiment = model?.experiment || [];
  const conflict = model?.context.majorConflict.trim();
  const conflictSentence = conflict?.replace(/[.!?。]+$/u, '');
  const insight = model?.context.desiredInsight.trim();
  const statement = experiment.length
    ? [
      conflictSentence ? `이번 실험의 출발 갈등: ${conflictSentence}.` : '',
      ...experiment.map((item) => `${item.days} ${item.title}. 실행: ${item.action} 확인: ${item.check}`)
    ].filter(Boolean).join(' ')
    : WITHHELD_STATEMENT;

  return chapter('thirty-day-experiment', {
    factBomb: experiment.length
      ? '30일 뒤 확인할 건 운명의 결론이 아니라, 둘이 실제로 바꾼 반복 행동이야.'
      : WITHHELD_FACT,
    statement,
    practicalRule: experiment.length
      ? `${insight ? `알고 싶은 점 “${insight}”이라는 기준으로 ` : ''}마지막 날 유지할 규칙 하나, 바꿀 규칙 하나, 멈출 행동 하나를 함께 약속해.`
      : WITHHELD_RULE,
    evidenceIds: unique(model?.evidenceIds || []),
    uncertainty: modelUncertainty(model)
  });
}

/**
 * Maps the deterministic match-couple report into the fixed 13-scene webtoon rhythm.
 * Missing calculations keep the scene skeleton but never synthesize a relationship result.
 */
export function buildMatchCoupleStoryChapters(
  model: MatchCoupleReportModel | null | undefined
): readonly MatchCoupleStoryChapter[] {
  return [
    twoChartsChapter(model),
    relationsChapter(model),
    guidanceChapter('attraction', model?.guidance?.attraction, model),
    guidanceChapter('emotional-expression', model?.guidance?.emotionalExpression, model),
    guidanceChapter('communication', model?.guidance?.communication, model),
    guidanceChapter('conflict-recovery', model?.guidance?.conflictRecovery, model),
    guidanceChapter('daily-life', model?.guidance?.dailyLife, model),
    guidanceChapter('money', model?.guidance?.money, model),
    guidanceChapter('long-term-roles', model?.guidance?.longTermRoles, model),
    cautionsChapter(model),
    rulesChapter(model),
    questionsChapter(model),
    experimentChapter(model)
  ];
}
