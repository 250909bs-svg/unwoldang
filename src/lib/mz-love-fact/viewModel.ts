import type { ReportSection, SajuReportData } from '../saju/report';
import { auditMzLoveText } from './contentSafety';
import { getMzLoveScene } from './sceneManifest';
import { resolveMzLoveChapterScenes } from './sceneResolver';
import type {
  ChapterLayout,
  FactBombResult,
  LovePartnerTendency,
  LoveReportChapter,
  MzLoveChapterId,
  EvidenceSource,
  EvidenceTag,
  MzLoveReport,
  MzLoveReportViewModel,
  MzLoveActionPlan,
  MzLoveSceneKey,
  RelationshipStatus,
  SajuChartSummary,
} from './types';

const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  single: '솔로 · 새로운 인연 탐색',
  meeting: '소개·만남 시작',
  situationship: '썸 · 관계 확인 중',
  dating: '연애 중',
  ambiguous: '애매한 관계',
  'breakup-reunion': '이별·재회 고민',
  'long-term': '기혼·장기 관계',
};

function makeEvidence(
  id: string,
  label: string,
  value: string,
  description: string,
  source: EvidenceSource,
  sourcePath: string,
  report: SajuReportData,
): EvidenceTag {
  return {
    id,
    label,
    value,
    description,
    source,
    sourcePath,
    immutable: true,
    confidence: report.engineMeta?.confidence ?? undefined,
  };
}

function evidenceSectionSource(id: string): EvidenceSource | null {
  if (id === 'compatibility-evidence-v2') return 'relationship';
  if (id === 'temporal-evidence-v2') return 'timing';
  if (id === 'expert-evidence-v2' || id === 'calculation-audit-v2') return 'engine-meta';
  return null;
}

interface SectionSourceText {
  text: string;
  sourcePath: string;
}

/**
 * Keeps the exact report field beside every section string. Evidence binding
 * relies on this path; array position or a similar-looking chapter is never a
 * sufficient reason to attach a deterministic record.
 */
function sectionSourceTexts(
  section: ReportSection,
  sectionIndex: number,
): SectionSourceText[] {
  return [
    ...(section.paragraphs ?? []).map((text, index) => ({
      text,
      sourcePath: `sections.${sectionIndex}.paragraphs.${index}`,
    })),
    ...(section.bullets ?? []).map((text, index) => ({
      text,
      sourcePath: `sections.${sectionIndex}.bullets.${index}`,
    })),
    ...(section.cards ?? []).map((card, index) => ({
      text: card.body,
      sourcePath: `sections.${sectionIndex}.cards.${index}.body`,
    })),
    ...(section.details ?? []).flatMap((detail, index) => [
      {
        text: detail.summary,
        sourcePath: `sections.${sectionIndex}.details.${index}.summary`,
      },
      {
        text: detail.content,
        sourcePath: `sections.${sectionIndex}.details.${index}.content`,
      },
    ]),
    ...(section.callout ? [{
      text: section.callout.body,
      sourcePath: `sections.${sectionIndex}.callout.body`,
    }] : []),
  ];
}

/** Converts immutable deterministic report fields without rewriting prose. */
export function collectDeterministicLoveEvidence(report: SajuReportData): EvidenceTag[] {
  const result: EvidenceTag[] = [
    makeEvidence('natal:day-master', '일간', report.dayMaster, report.dayMaster, 'natal-chart', 'dayMaster', report),
    makeEvidence('natal:day-pillar', '일주', report.pillars.day, report.pillars.day, 'natal-chart', 'pillars.day', report),
    makeEvidence('natal:strength', '신강약', report.strengthLabel, report.strengthLabel, 'natal-chart', 'strengthLabel', report),
  ];

  report.visibleTenGods.forEach((item, index) => {
    result.push(makeEvidence(
      `ten-god:${index}:${item.pillar}`,
      `${item.pillar} 십성`,
      `${item.stemTenGod}·${item.branchTenGod}`,
      item.reading,
      'ten-god',
      `visibleTenGods.${index}.reading`,
      report,
    ));
  });

  report.sections.forEach((section, sectionIndex) => {
    const source = evidenceSectionSource(section.id);
    if (!source) return;
    sectionSourceTexts(section, sectionIndex).forEach((entry, valueIndex) => {
      if (!entry.text.trim()) return;
      result.push(makeEvidence(
        `${section.id}:${valueIndex}`,
        section.title,
        entry.text,
        entry.text,
        source,
        entry.sourcePath,
        report,
      ));
    });
  });

  return [...new Map(result.map((item) => [item.id, item])).values()];
}

export function adaptSajuReportToMzLoveSummary(
  report: SajuReportData,
  options: { birthTimeKnown?: boolean } = {},
): SajuChartSummary {
  const birthTimeKnown = options.birthTimeKnown ?? report.pillars.hour !== null;
  const uncertainty = [...(report.engineMeta?.uncertainty ?? [])];
  if (!birthTimeKnown) uncertainty.push('출생시간 미입력으로 시주와 일부 시기 해석은 제한됩니다.');
  return {
    sourceReportSerial: report.serialNumber,
    dayMaster: report.dayMaster,
    dayMasterElement: report.dayMasterElement,
    strengthLabel: report.strengthLabel,
    pillars: { ...report.pillars },
    helpfulElements: [...report.helpfulElements],
    cautiousElements: [...report.cautiousElements],
    dominantTenGods: [...report.tenGods]
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
      .map((item) => ({ ...item })),
    birthTimeKnown,
    calculationPrecision: report.engineMeta?.calculationPrecision ?? 'unknown',
    evidence: collectDeterministicLoveEvidence(report),
    uncertainty: [...new Set(uncertainty)],
  };
}

interface AdapterChapterDefinition {
  id: MzLoveChapterId;
  title: string;
  sceneKey: MzLoveSceneKey | null;
  layout: ChapterLayout;
  factBomb: string;
}

const ADAPTER_CHAPTERS: readonly AdapterChapterDefinition[] = [
  { id: 'love-self', title: '너, 연애할 때 딴사람 돼', sceneKey: 'love-self-mirror', layout: 'mirror', factBomb: '평소의 판단 속도와 호감이 생겼을 때의 확인 속도는 다를 수 있어.' },
  { id: 'repeated-attraction', title: '왜 늘 이런 사람에게 꽂힐까', sceneKey: 'attraction-danger', layout: 'cinematic', factBomb: '강한 설렘이 안정적인 관계 신호와 같은 뜻은 아니야.' },
  { id: 'attracted-partner', title: '네가 끌리는 사람', sceneKey: 'future-partner-fan', layout: 'conversation', factBomb: '첫인상보다 관계를 명확히 만드는 행동을 함께 봐야 해.' },
  { id: 'lasting-partner', title: '오래 갈 사람은 따로 있어', sceneKey: 'stable-partner-signal', layout: 'cinematic', factBomb: '오래 갈 가능성은 말의 강도보다 행동의 일관성에서 확인돼.' },
  { id: 'attraction-comparison', title: '끌리는 사람 vs 오래 갈 사람', sceneKey: 'attraction-vs-longevity', layout: 'comparison', factBomb: '설렘과 안정감을 같은 기준으로 채점하지 마.' },
  { id: 'next-partner', title: '다음 인연의 첫 신호', sceneKey: 'whisper-fact', layout: 'conversation', factBomb: '얼굴이나 직업을 맞히기보다 관계를 만드는 태도를 보는 게 먼저야.' },
  { id: 'meeting-scenes', title: '어디서 어떻게 시작될까', sceneKey: 'first-meeting-scene', layout: 'cinematic', factBomb: '만남의 장소보다 대화가 반복되는 생활 반경을 먼저 넓혀 봐.' },
  { id: 'twelve-month-timing', title: '지금부터 12개월 연애 흐름', sceneKey: 'room-corridor', layout: 'timeline', factBomb: '좋은 흐름도 기다리는 날짜가 아니라 움직임을 조정하는 참고 신호야.' },
  { id: 'communication-pattern', title: '연락에서 네가 놓치는 포인트', sceneKey: 'waiting-for-message', layout: 'conversation', factBomb: '답장 속도 하나로 관계 전체를 해석하지 마.' },
  { id: 'relationship-status', title: '지금 관계에 맞는 팩폭', sceneKey: 'room-consultation', layout: 'conversation', factBomb: '관계의 이름보다 서로가 실제로 합의한 행동을 확인해.' },
  { id: 'relationship-flags', title: '레드 플래그와 그린 플래그', sceneKey: 'hero-fan-closed', layout: 'flags', factBomb: '불안을 설렘으로, 평온함을 지루함으로 착각하지 않는 연습이 필요해.' },
  { id: 'action-plan', title: '이번엔 이렇게 해야 안 망해', sceneKey: null, layout: 'checklist', factBomb: '생각을 더 돌리기보다 관찰할 행동 기준을 정해.' },
  { id: 'final-fact', title: '마지막 팩폭', sceneKey: 'final-fact-bomb', layout: 'cinematic', factBomb: '네가 좋아하는지만 보지 말고, 그 사람이 관계를 실제로 만들고 있는지 봐.' },
];

interface ChapterFallbackCopy {
  interpretation: string;
  realLifeScene: string;
  counterpoint: string;
  checkSignal: string;
  action: string;
}

/**
 * These lines are deliberately written per chapter. A generic engine paragraph
 * is never a better customer experience than a clear, relationship-only
 * fallback that matches the scene the customer is currently reading.
 */
const CHAPTER_FALLBACK_COPY: Record<MzLoveChapterId, ChapterFallbackCopy> = {
  'love-self': {
    interpretation: '호감이 커질수록 상대의 가능성을 오래 보는 편이라면, 내 감정보다 확인된 행동을 기준으로 다시 봐야 해.',
    realLifeScene: '답장이 늦은 날 상대의 말투를 여러 번 떠올리며 괜찮은 이유를 대신 만들어 주는 장면으로 나타날 수 있어.',
    counterpoint: '기다리는 동안에도 상대가 먼저 약속을 잡고 관계를 분명히 한다면 단순히 표현 속도가 느린 사람일 수 있어.',
    checkSignal: '마음이 흔들린 순간마다 확인된 사실과 내가 붙인 해석을 두 줄로 나눠 적어 봐.',
    action: '이번 주에는 호감의 크기보다 상대가 실제로 건넨 시간과 약속을 기록해.',
  },
  'repeated-attraction': {
    interpretation: '확신을 늦게 주는 사람에게 더 오래 마음을 쓰는지 보면 반복되는 끌림의 정체가 선명해져.',
    realLifeScene: '연락은 들쑥날쑥한데 가끔 강한 표현이 오면 이전의 불안을 한꺼번에 잊는 장면이 반복될 수 있어.',
    counterpoint: '처음에는 조심스러워도 만남과 대화가 점점 구체적으로 이어진다면 같은 패턴으로 단정할 필요는 없어.',
    checkSignal: '설레게 한 말보다 약속을 지킨 횟수와 관계를 분명히 한 행동을 함께 세어 봐.',
    action: '강하게 끌린 이유와 실제로 편안했던 이유를 따로 적어 비교해.',
  },
  'attracted-partner': {
    interpretation: '자기 세계가 뚜렷하고 쉽게 읽히지 않는 분위기가 호기심을 자극할 수 있어.',
    realLifeScene: '첫 대화가 빠르게 깊어지면 아직 모르는 부분까지 특별함으로 채워 보는 장면이 생길 수 있어.',
    counterpoint: '첫인상이 강해도 상대가 경계를 존중하고 관계의 속도를 함께 맞춘다면 건강한 끌림으로 이어질 수 있어.',
    checkSignal: '나를 궁금해하는 말과 내 시간을 실제로 존중하는 행동이 함께 있는지 봐.',
    action: '첫인상에 점수를 주기 전에 세 번의 만남에서 태도가 같은지 확인해.',
  },
  'lasting-partner': {
    interpretation: '오래 갈 사람은 감정을 크게 말하는 사람보다 불편한 순간에도 대화를 다시 여는 사람이야.',
    realLifeScene: '약속이 바뀌었을 때 미안하다는 말로 끝내지 않고 새 시간을 먼저 제안하는 모습에서 안정감이 보여.',
    counterpoint: '표현이 다정해도 중요한 질문을 계속 피하고 약속을 흐린다면 오래 갈 신호로 보기 어려워.',
    checkSignal: '갈등 뒤 연락을 끊는지, 감정을 정리한 뒤 해결할 대화를 다시 시작하는지 확인해.',
    action: '좋아한다는 말보다 약속·회복·경계 존중이 반복되는지 세 주 동안 봐.',
  },
  'attraction-comparison': {
    interpretation: '설렘은 시작의 힘이고 안정감은 관계를 이어 가는 힘이라서 서로 다른 기준으로 봐야 해.',
    realLifeScene: '한 사람과는 밤새 대화가 이어지고, 다른 사람과는 약속을 걱정하지 않아도 되는 차이로 느껴질 수 있어.',
    counterpoint: '강한 설렘과 안정적인 행동이 한 사람에게 함께 보인다면 둘 중 하나만 고를 필요는 없어.',
    checkSignal: '만난 뒤 들뜬 정도와 마음이 편안해진 정도를 각각 따로 기록해 봐.',
    action: '끌림, 약속, 대화 회복, 경계 존중을 네 칸으로 나눠 비교해.',
  },
  'next-partner': {
    interpretation: '다음 인연의 외모를 맞히기보다 관계를 책임 있게 시작하는 태도를 알아보는 게 더 중요해.',
    realLifeScene: '처음부터 과하게 다가오기보다 다음 만남을 구체적으로 잡고 연락의 리듬을 맞추는 사람으로 보일 수 있어.',
    counterpoint: '차분한 첫인상이 곧 좋은 관계를 뜻하지는 않으니, 중요한 질문에 답하는 태도까지 함께 봐야 해.',
    checkSignal: '호감 표현 뒤에 다음 약속, 시간 배려, 관계에 대한 분명한 대화가 이어지는지 확인해.',
    action: '다음 사람에게 바라는 외형 대신 꼭 지켜졌으면 하는 관계 행동 세 가지를 적어.',
  },
  'meeting-scenes': {
    interpretation: '인연은 한 번 스치는 자리보다 자연스럽게 대화가 반복되는 생활 반경에서 시작될 가능성이 커.',
    realLifeScene: '취미 모임, 배움의 자리, 지인 소개처럼 다시 만날 이유가 있는 곳에서 말이 이어질 수 있어.',
    counterpoint: '장소가 좋아도 대화와 약속이 이어지지 않으면 만남 자체에 의미를 과하게 붙이지 마.',
    checkSignal: '한 번의 우연보다 두 번째 대화와 다음 만남이 자연스럽게 만들어지는지 봐.',
    action: '이번 달에는 관심 있는 모임 하나와 믿을 만한 지인 소개 한 번을 열어 둬.',
  },
  'twelve-month-timing': {
    interpretation: '연애 흐름은 정해진 사건표가 아니라 만남을 넓힐 때와 관계를 천천히 볼 때를 구분하는 참고선이야.',
    realLifeScene: '대화가 늘어나는 달에는 접점을 넓히고, 마음이 지치는 달에는 답을 재촉하지 않는 식으로 속도를 조절해.',
    counterpoint: '좋은 흐름이어도 상대의 행동이 불분명하면 기다릴 이유가 생기는 것은 아니야.',
    checkSignal: '매달 만남의 수보다 대화가 이어진 관계와 지켜진 약속을 확인해.',
    action: '한 달에 한 번 연락·만남·마음의 편안함을 돌아보고 다음 속도를 정해.',
  },
  'communication-pattern': {
    interpretation: '답장 속도 하나에 마음을 맡기면 실제 관계보다 내 불안이 대화를 끌고 갈 수 있어.',
    realLifeScene: '평소보다 답장이 늦은 날 메시지를 다시 읽고 일부러 나도 늦게 답하고 싶어질 수 있어.',
    counterpoint: '연락 간격이 길어도 미리 알려 주고 약속한 대화를 이어 간다면 애정이 부족하다고 단정할 수 없어.',
    checkSignal: '연락 횟수보다 끊긴 대화를 다시 잇는지, 필요한 말을 피하지 않는지 봐.',
    action: '서운함을 시험으로 돌리지 말고 원하는 연락 방식을 짧고 구체적으로 말해.',
  },
  'relationship-status': {
    interpretation: '관계의 이름보다 두 사람이 같은 방향과 속도에 합의했는지가 지금 판단의 핵심이야.',
    realLifeScene: '서로 좋아한다는 말은 하지만 다음 약속이나 관계의 방향을 물으면 대화가 흐려질 수 있어.',
    counterpoint: '이름을 늦게 정해도 서로의 시간과 경계를 존중하며 약속을 지킨다면 관계는 자라고 있을 수 있어.',
    checkSignal: '앞으로의 만남과 연락, 다른 이성과의 경계를 서로 같은 뜻으로 이해하는지 확인해.',
    action: '원하는 관계와 기다릴 수 있는 기간을 한 문장으로 말하고 답을 행동으로 확인해.',
  },
  'relationship-flags': {
    interpretation: '불안을 키우는 행동과 신뢰를 쌓는 행동을 함께 봐야 설렘에 가려진 관계의 방향이 보여.',
    realLifeScene: '다정한 말 뒤에 잠수가 반복되거나, 불편한 질문을 했을 때 네 탓으로 돌리는 모습이 경고가 될 수 있어.',
    counterpoint: '서툰 실수가 있어도 인정하고 대안을 만들며 같은 행동을 줄여 간다면 회복 가능한 관계일 수 있어.',
    checkSignal: '사과의 말보다 같은 문제가 줄어드는지, 네 경계를 존중하는 행동이 생기는지 봐.',
    action: '멈출 신호와 계속 볼 신호를 각각 세 가지 정해 실제 장면과 비교해.',
  },
  'action-plan': {
    interpretation: '생각을 더 많이 하는 것보다 관찰하고 묻고 선택하는 작은 행동이 연애 패턴을 바꿔.',
    realLifeScene: '불안할 때 바로 결론을 내리거나 참기만 했던 순간에 짧은 질문 하나를 꺼내는 연습부터 시작해.',
    counterpoint: '모든 관계를 점검표처럼 대하면 마음이 메말라질 수 있으니 감정과 행동을 함께 존중해야 해.',
    checkSignal: '한 주마다 내가 솔직히 말했는지, 상대가 행동으로 답했는지, 마음이 편안해졌는지 돌아봐.',
    action: '기록, 질문, 경계, 선택의 순서로 서른 날 동안 한 가지씩 실천해.',
  },
  'final-fact': {
    interpretation: '좋아하는 마음은 관계의 시작일 뿐이고, 서로 관계를 만드는 행동이 있어야 사랑이 현실에 남아.',
    realLifeScene: '상대의 한마디를 기다리느라 내 하루를 멈추는 대신, 이미 보여 준 행동으로 관계를 바라봐야 할 때야.',
    counterpoint: '조심스러운 사람도 충분히 행동할 수 있으니 빠르지 않다는 이유만으로 마음이 없다고 단정하지 마.',
    checkSignal: '이 관계에서 나만 기다리고 해석하는지, 두 사람이 함께 약속하고 움직이는지 마지막으로 봐.',
    action: '나를 불안하게 붙잡는 관계보다 나와 함께 만들어 가는 관계를 선택해.',
  },
};

type RelationshipStatusChapterCopy = ChapterFallbackCopy & { factBomb: string };

const RELATIONSHIP_STATUS_CHAPTER_COPY: Record<RelationshipStatus, RelationshipStatusChapterCopy> = {
  single: {
    factBomb: '지금은 외로움이 커진 날의 선택과 네가 진짜 원하는 관계를 구분해야 해.',
    interpretation: '솔로인 지금은 누가 나타날지를 기다리기보다 어떤 관계에서 편안한지 기준을 먼저 세울 때야.',
    realLifeScene: '외로운 밤에 강하게 다가오는 사람에게 마음을 빨리 열었다가, 약속이 흐려진 뒤 혼자 의미를 붙일 수 있어.',
    counterpoint: '호감이 빠르게 생겨도 상대가 다음 약속을 구체적으로 만들고 네 속도를 존중한다면 천천히 알아가도 괜찮아.',
    checkSignal: '새 만남에서 설렌 정도와 다음 약속·연락·경계 존중이 이어진 정도를 따로 봐.',
    action: '이번 달에는 새 접점 두 곳을 열되, 세 번의 만남 전까지 말보다 반복되는 태도를 확인해.',
  },
  meeting: {
    factBomb: '첫 만남의 호감보다 두 번째 약속이 실제로 잡히는지 봐.',
    interpretation: '소개와 만남이 시작된 단계에서는 첫인상의 강도보다 서로 시간을 다시 내는 행동이 관계의 방향을 보여 줘.',
    realLifeScene: '대화는 즐거웠지만 다음 만남을 계속 “언젠가”로 남기거나 한쪽만 일정을 묻는 장면이 생길 수 있어.',
    counterpoint: '일정이 늦게 잡혀도 가능한 날짜를 먼저 제안하고 연락의 이유가 분명하다면 관심이 약하다고 단정할 필요는 없어.',
    checkSignal: '만남 뒤 7일 안에 다음 대화나 약속을 두 사람이 함께 구체화하는지 확인해.',
    action: '좋았다는 말에서 멈추지 말고, 편한 날짜 하나를 먼저 제안한 뒤 상대의 행동을 봐.',
  },
  situationship: {
    factBomb: '썸은 설렘이 아니라 다음 약속과 관계 방향이 함께 선명해질 때 앞으로 가.',
    interpretation: '썸 단계에서는 연락의 온도보다 서로가 같은 속도로 관계를 구체화하는지가 핵심이야.',
    realLifeScene: '매일 연락하면서도 주말 약속이나 다른 이성과의 경계를 물으면 대화가 흐려질 수 있어.',
    counterpoint: '표현은 조심스러워도 만남을 이어 가고 중요한 질문에 답한다면 천천히 깊어지는 관계일 수 있어.',
    checkSignal: '연락량과 별개로 다음 약속, 독점성, 원하는 관계를 같은 뜻으로 말할 수 있는지 봐.',
    action: '이번 주 안에 “나는 우리를 더 알아가고 싶은데 너는 어때?”라고 짧게 확인해.',
  },
  dating: {
    factBomb: '사귀는 이름보다 갈등 뒤에도 관계를 다시 여는 행동이 오래 갈 답이야.',
    interpretation: '연애 중인 관계에서는 애정 표현의 크기보다 약속과 경계, 갈등 뒤 회복 방식이 안정성을 보여 줘.',
    realLifeScene: '좋을 때는 다정하지만 불편한 이야기가 나오면 연락을 끊거나 한쪽만 사과하는 흐름이 반복될 수 있어.',
    counterpoint: '갈등이 있어도 서로 책임을 인정하고 다음 행동을 바꾼다면 관계는 더 단단해질 수 있어.',
    checkSignal: '같은 문제가 줄어드는지, 약속 변경 뒤 대안이 생기는지, 두 사람의 시간이 균형 잡히는지 확인해.',
    action: '이번 주 대화에서 서운함 하나와 원하는 변화 하나를 비난 없이 짝지어 말해.',
  },
  ambiguous: {
    factBomb: '좋아한다는 말보다 관계의 방향과 기다릴 수 있는 기간을 확인해야 해.',
    interpretation: '애매한 관계에서는 감정의 크기보다 두 사람이 같은 방향에 합의할 수 있는지가 판단의 핵심이야.',
    realLifeScene: '만날 때는 연인 같지만 다음 약속이나 관계 정의를 물으면 바쁨과 상황 이야기만 길어질 수 있어.',
    counterpoint: '이름을 늦게 정해도 약속을 지키고 중요한 질문을 피하지 않는다면 관계는 자라고 있을 수 있어.',
    checkSignal: '앞으로의 만남, 연락, 다른 이성과의 경계를 서로 같은 뜻으로 이해하는지 봐.',
    action: '원하는 관계와 기다릴 수 있는 기간을 한 문장으로 말하고, 답을 행동으로 확인해.',
  },
  'breakup-reunion': {
    factBomb: '그리움보다 헤어진 원인이 실제로 달라졌는지 먼저 봐.',
    interpretation: '재회는 감정이 남았다는 사실보다 이별을 만든 행동과 환경이 바뀌었는지로 판단해야 해.',
    realLifeScene: '추억을 이야기할 때는 가까워지지만 왜 헤어졌는지 묻는 순간 사과만 반복되고 구체적인 변화는 흐려질 수 있어.',
    counterpoint: '서로의 책임을 인정하고 같은 문제가 생겼을 때의 새 대응을 실제로 보여 준다면 재회를 검토할 수 있어.',
    checkSignal: '연락 재개보다 이별 원인, 달라진 행동, 다시 어긋날 때의 약속 세 가지가 구체적인지 확인해.',
    action: '재회를 결정하기 전 3주 동안 말이 아니라 달라진 일상 행동이 반복되는지 봐.',
  },
  'long-term': {
    factBomb: '사랑의 크기보다 갈등 뒤 대화를 다시 여는 방식과 생활 약속을 봐.',
    interpretation: '기혼·장기 관계에서는 익숙함 속에서도 감정과 생활 책임을 다시 나누는 대화가 관계 온도를 지켜 줘.',
    realLifeScene: '큰 다툼은 없지만 일정과 돈, 집안일을 한 사람이 더 많이 기억하며 서운함이 조용히 쌓일 수 있어.',
    counterpoint: '표현이 줄었어도 생활 책임을 함께 조정하고 둘만의 시간을 다시 만든다면 애정은 회복될 수 있어.',
    checkSignal: '일정·돈·돌봄·휴식의 부담과 원하는 애정 표현을 서로 같은 기준으로 알고 있는지 확인해.',
    action: '이번 주 20분 동안 잘잘못 대신 줄이고 싶은 부담 하나와 늘리고 싶은 시간 하나를 합의해.',
  },
};

function inferRelationshipStatus(report: SajuReportData): RelationshipStatus {
  const question = report.questionPreview;
  if (/(이별|재회|헤어진)/.test(question)) return 'breakup-reunion';
  if (/(기혼|부부|배우자|결혼생활)/.test(question)) return 'long-term';
  if (/(애매|정의되지|기다려)/.test(question)) return 'ambiguous';
  if (/(썸|호감|소개받)/.test(question)) return 'situationship';
  if (/(연애\s*중|남자친구|여자친구|애인)/.test(question)) return 'dating';
  return 'single';
}

const DEFAULT_INTERPRETATION = CHAPTER_FALLBACK_COPY['love-self'].interpretation;
const DEFAULT_REAL_LIFE_SCENE = CHAPTER_FALLBACK_COPY['love-self'].realLifeScene;
const DEFAULT_COUNTERPOINT = CHAPTER_FALLBACK_COPY['love-self'].counterpoint;
const DEFAULT_CHECK_SIGNAL = CHAPTER_FALLBACK_COPY['love-self'].checkSignal;
const DEFAULT_ACTION = CHAPTER_FALLBACK_COPY['love-self'].action;

function adapterFact(
  id: string,
  factBomb: string,
  evidence: readonly EvidenceTag[],
  copy: Partial<Pick<FactBombResult, 'interpretation' | 'realLifeScene' | 'counterpoint' | 'checkSignal' | 'action'>> = {},
): FactBombResult {
  return {
    id,
    factBomb,
    interpretation: copy.interpretation ?? DEFAULT_INTERPRETATION,
    evidence,
    realLifeScene: copy.realLifeScene ?? DEFAULT_REAL_LIFE_SCENE,
    counterpoint: copy.counterpoint ?? DEFAULT_COUNTERPOINT,
    checkSignal: copy.checkSignal ?? DEFAULT_CHECK_SIGNAL,
    action: copy.action ?? DEFAULT_ACTION,
    characterLine: { speaker: 'mz-shaman', text: factBomb, tone: 'direct' },
  };
}

export function evidenceFromExactSource(
  evidence: readonly EvidenceTag[],
  sourcePath: string | undefined,
): EvidenceTag[] {
  if (!sourcePath) return [];
  return evidence.filter((item) => item.sourcePath === sourcePath).slice(0, 6);
}

const CHAPTER_SOURCE_TERMS: Record<MzLoveChapterId, readonly string[]> = {
  'love-self': ['연애', '감정', '마음', '호감', '선택', '판단', '가능성', '편안', '소모', '감정 체력', '상대의 말'],
  'repeated-attraction': ['반복', '끌', '설렘', '설레', '패턴', '불안'],
  'attracted-partner': ['끌', '이상형', '매력', '첫인상', '호감', '호기심', '차분', '분위기', '자기 기준'],
  'lasting-partner': ['오래', '안정', '배우자', '책임', '결혼', '갈등', '회복', '편안', '불편한 대화', '다시 연결', '해결', '일관성'],
  'attraction-comparison': ['끌', '안정', '설렘', '비교', '차이', '편안', '각각', '책임감', '다른 기준'],
  'next-partner': ['다음', '인연', '배우자', '앞으로 만날', '다음 사람', '관계를 책임', '다음 약속'],
  'meeting-scenes': ['만남', '만나', '소개', '인연', '대화', '장소', '모임', '생활 반경', '접점'],
  'twelve-month-timing': ['12개월', '열두 달', '개월', '이번 달', '매달', '달', '월별', '시기', '흐름', '구간', '타이밍', '속도 조절', '앞으로', '사건'],
  'communication-pattern': ['연락', '답장', '메시지', '대화', '표현', '말', '말투'],
  'relationship-status': ['질문', '관계', '고민', '상대', '합의', '방향', '기다릴', '재회', '이별', '애매', '관계 정의', '결론', '참다', '끊어'],
  'relationship-flags': ['주의', '경계', '경고', '위험', '안정', '갈등', '회복', '불안', '신뢰', '사과', '신호'],
  'action-plan': ['행동', '실천', '우선', '확인', '기록', '질문', '연습', '점검', '한 주', '30일', '7일', '계획'],
  'final-fact': ['조언', '핵심', '요약', '결론', '마지막', '결국', '선택', '관계', '사랑', '함께'],
};

const CHAPTER_EYEBROWS: Record<MzLoveChapterId, string> = {
  'love-self': '연애 자화상',
  'repeated-attraction': '반복되는 끌림',
  'attracted-partner': '설렘의 방향',
  'lasting-partner': '지속 가능성',
  'attraction-comparison': '두 사람의 차이',
  'next-partner': '다음 관계의 기준',
  'meeting-scenes': '만남의 생활 반경',
  'twelve-month-timing': '관계 온도 지도',
  'communication-pattern': '연락과 대화',
  'relationship-status': '지금 관계 진단',
  'relationship-flags': '위험·안정 신호',
  'action-plan': '30일 행동 설계',
  'final-fact': '마지막 한마디',
};

/**
 * Customer copy and immutable evidence intentionally travel through separate paths.
 * These markers are valid inside EvidenceTag, but never as a webtoon line.
 */
const ENGINE_OR_AUDIT_COPY_PATTERNS: readonly RegExp[] = [
  /근거\s*(?:ID|아이디|식별자|경로)/iu,
  /(?:근거|관계|활성|판정|규칙)\s*\d+\s*건/iu,
  /(?:후보|규칙|rule|source|finding|opinion)\s*:/iu,
  /(?:MRE|TEMP|NATAL|REL|CALC)(?:-V?\d+)?[-:_][A-Z0-9:_-]+/iu,
  /\[\s*근거\s*:/u,
  /(?:교차\s*)?(?:합|충|형|파|해)(?:\s*[·,/+]\s*(?:합|충|형|파|해))+/u,
  /(?:육합|삼합|방합|반합|암합|쟁합|투합|합화)(?:\s*[·,/+]\s*(?:육합|삼합|방합|반합|암합|쟁합|투합|합화))*/u,
  /(?:월령|투간|통근|득령|득지|득세|화기\s*성립|존재\s*관계|성립\s*조건|근기\s*검증)/u,
  /(?:십성|천간|지지|원국|격국|억부|조후|용신|기신|통관|병약|대운|세운|월운)\s*(?:활성|관점|계산|판정|분포|비율|후보|근거|점수|검증)?/u,
  /(?:후보|신뢰도|정확도|확률)\s*(?:는|은|:)?\s*[^.!?]{0,40}\d{1,3}\s*%/u,
  /\d{1,3}\s*%/u,
  /(?:엔진|engine|calculation|audit|evidence|validation|sourcePath|engineMeta|calculationPrecision|validationStatus|scenarioCount|confidence)/iu,
  /(?:계산|품질|검증)\s*(?:감사|로그|메타|버전|상태|점수|정밀도)/u,
  /(?:결정론|원문\s*근거|산출\s*근거)/u,
  /유보/u,
  /활성화됩니다/u,
];

const BUSINESS_COPY_PATTERNS: readonly RegExp[] = [
  /(?:대표\s*)?결과물/u,
  /(?:가격표?|단가|매출|수익|정산|결제|환불|재구매|반복\s*고객|고객\s*응대|고객층|고정비)/u,
  /(?:제공|수정|업무|계약|서비스|상품|사업|창업|포트폴리오|마케팅|운영)\s*(?:범위|횟수|시간|기준|구조|표|전략|계획|체계|상품)?/u,
  /(?:일정|책임|역할)\s*범위/u,
  /(?:클레임|파일럿|유료\s*검증|수익\s*모델|세금|광고|CS)\b/iu,
  /고객/u,
];

const RELATIONSHIP_NARRATIVE_PATTERNS: readonly RegExp[] = [
  /연애|사랑|관계|호감|설렘|끌림|상대|연인|애인|배우자|결혼|이별|재회|썸/u,
  /마음|감정|만남|연락|답장|대화|말|행동|표현|약속|갈등|회복|경계|기다림|신뢰|첫인상/u,
];

function normalizeCopy(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isCustomerNarrativeText(
  value: string | undefined,
  excludedValues: ReadonlySet<string> = new Set<string>(),
): value is string {
  if (!value) return false;
  const normalized = normalizeCopy(value);
  if (normalized.length < 8 || normalized.length > 260) return false;
  if (excludedValues.has(normalized)) return false;
  if (ENGINE_OR_AUDIT_COPY_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  if (BUSINESS_COPY_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  if (!RELATIONSHIP_NARRATIVE_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return auditMzLoveText(normalized).length === 0;
}

/** Shared by the renderer for raw month-luck prose that bypasses chapter data. */
export function mzLoveCustomerNarrativeOrFallback(value: string | undefined, fallback: string): string {
  return isCustomerNarrativeText(value) ? normalizeCopy(value) : fallback;
}

function isChapterCustomerNarrativeText(
  value: string | undefined,
  chapterId: MzLoveChapterId,
  excludedValues: ReadonlySet<string> = new Set<string>(),
): value is string {
  return isCustomerNarrativeText(value, excludedValues)
    && CHAPTER_SOURCE_TERMS[chapterId].some((term) => normalizeCopy(value).includes(term));
}

function customerFacingChapterField(
  value: string | undefined,
  fallback: string,
  chapterId: MzLoveChapterId,
  excludedValues: ReadonlySet<string>,
): string {
  return isChapterCustomerNarrativeText(value, chapterId, excludedValues) ? normalizeCopy(value) : fallback;
}

interface ChapterCustomerCopy {
  insights: readonly CustomerSourceText[];
  actions: readonly CustomerSourceText[];
}

interface CustomerSourceText {
  text: string;
  sourcePath: string;
}

function rankCustomerTexts(
  values: readonly CustomerSourceText[],
  chapterId: MzLoveChapterId,
): CustomerSourceText[] {
  const terms = CHAPTER_SOURCE_TERMS[chapterId];
  const unique = new Map<string, CustomerSourceText & { index: number }>();
  values.forEach((item, index) => {
    if (!unique.has(item.text)) unique.set(item.text, { ...item, index });
  });
  return [...unique.values()]
    .map((item) => {
      const score = terms.filter((term) => item.text.includes(term)).length;
      const maxChapterScore = Math.max(...Object.values(CHAPTER_SOURCE_TERMS).map((candidateTerms) => (
        candidateTerms.filter((term) => item.text.includes(term)).length
      )));
      return { ...item, score, maxChapterScore };
    })
    // A single broad word such as "관계" or "흐름" is not enough to move
    // source prose into a paid chapter. Requiring two independent topic
    // signals prevents generic advice and sentence fragments from leaking
    // across otherwise unrelated chapters.
    .filter((item) => item.score >= 2 && item.score === item.maxChapterScore)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ text, sourcePath }) => ({ text, sourcePath }));
}

function chapterSourceTexts(report: SajuReportData, chapterId: MzLoveChapterId): ChapterCustomerCopy {
  const excludedValues = new Set([
    report.questionPreview,
    report.summary.title,
    report.actionPlan.title,
    ...report.keyTakeaways.map((item) => item.title),
    ...report.questionAnswers.flatMap((item) => [item.question, item.title]),
    ...report.sections.flatMap((section) => [
      section.title,
      ...(section.cards ?? []).map((card) => card.title),
      ...(section.details ?? []).map((detail) => detail.summary),
      ...(section.callout?.title ? [section.callout.title] : []),
    ]),
  ].map(normalizeCopy).filter(Boolean));

  const sectionBodies = report.sections.flatMap((section, sectionIndex) => (
    section.id === 'calculation-audit-v2' ? [] : sectionSourceTexts(section, sectionIndex)
  ));

  const insights = [
    ...report.summary.analysis.map((text, index) => ({ text, sourcePath: `summary.analysis.${index}` })),
    ...report.keyTakeaways.map((item, index) => ({ text: item.body, sourcePath: `keyTakeaways.${index}.body` })),
    ...sectionBodies,
    ...report.questionAnswers.map((item, index) => ({ text: item.analysis, sourcePath: `questionAnswers.${index}.analysis` })),
  ].filter((item): item is CustomerSourceText => isCustomerNarrativeText(item.text, excludedValues))
    .map((item) => ({ ...item, text: normalizeCopy(item.text) }));

  const actions = [
    ...report.summary.advice.map((text, index) => ({ text, sourcePath: `summary.advice.${index}` })),
    ...report.questionAnswers.flatMap((item, answerIndex) => item.advice.map((text, adviceIndex) => ({
      text,
      sourcePath: `questionAnswers.${answerIndex}.advice.${adviceIndex}`,
    }))),
    ...report.actionPlan.priorities.map((text, index) => ({ text, sourcePath: `actionPlan.priorities.${index}` })),
    ...report.actionPlan.dos.map((text, index) => ({ text, sourcePath: `actionPlan.dos.${index}` })),
  ].filter((item): item is CustomerSourceText => isCustomerNarrativeText(item.text, excludedValues))
    .map((item) => ({ ...item, text: normalizeCopy(item.text) }));

  return {
    insights: rankCustomerTexts(insights, chapterId),
    actions: rankCustomerTexts(actions, chapterId),
  };
}

function partnerTendency(
  headline: string,
  evidence: readonly EvidenceTag[],
  stable: boolean,
): LovePartnerTendency {
  return {
    headline,
    traits: stable
      ? ['관계를 말로 정의하고 행동으로 지키는 편', '갈등 뒤에 대화를 다시 여는 편', '생활 리듬을 공유할 수 있는 편']
      : ['첫인상이 강하거나 자기 세계가 뚜렷한 편', '감정 표현의 속도가 일정하지 않을 수 있음', '호기심을 빠르게 자극하는 편'],
    earlySignals: stable
      ? ['약속을 구체적으로 잡음', '변경 시 대안을 제시함', '불편한 질문에도 대화를 이어감']
      : ['대화의 밀도가 빠르게 높아짐', '예상하기 어려운 반응이 호기심을 자극함'],
    cautionSignals: stable
      ? ['평온함을 지루함으로 오해하는지 확인']
      : ['말의 강도와 관계의 책임을 같은 것으로 보지 않기'],
    evidence,
  };
}

export function buildMzLoveReportFromSaju(
  report: SajuReportData,
  options: { relationshipStatus?: RelationshipStatus; birthTimeKnown?: boolean } = {},
): MzLoveReport {
  const sajuSummary = adaptSajuReportToMzLoveSummary(report, options);
  const status = options.relationshipStatus ?? inferRelationshipStatus(report);
  const usedFactBombs = new Set<string>();
  const usedCustomerSourceTexts = new Set<string>();
  const chapters: LoveReportChapter[] = ADAPTER_CHAPTERS.map((definition, index) => {
    const statusCopy = definition.id === 'relationship-status'
      ? RELATIONSHIP_STATUS_CHAPTER_COPY[status]
      : null;
    const fallback = statusCopy ?? CHAPTER_FALLBACK_COPY[definition.id];
    const sourceTexts = chapterSourceTexts(report, definition.id);
    const factSource = statusCopy
      ? undefined
      : sourceTexts.insights.find((item) => (
        !usedFactBombs.has(item.text) && !usedCustomerSourceTexts.has(item.text)
      ));
    const factBomb = statusCopy?.factBomb ?? factSource?.text ?? definition.factBomb;
    usedFactBombs.add(factBomb);
    if (factSource) usedCustomerSourceTexts.add(factSource.text);
    const supportingTexts = statusCopy
      ? []
      : sourceTexts.insights.filter((item) => (
        item.text !== factBomb && !usedCustomerSourceTexts.has(item.text)
      ));
    const interpretationSource = supportingTexts[0];
    if (interpretationSource) usedCustomerSourceTexts.add(interpretationSource.text);
    const realLifeSource = supportingTexts.find((item) => !usedCustomerSourceTexts.has(item.text));
    if (realLifeSource) usedCustomerSourceTexts.add(realLifeSource.text);
    const chapterEvidence = evidenceFromExactSource(sajuSummary.evidence, interpretationSource?.sourcePath);
    const actionSource = statusCopy
      ? undefined
      : sourceTexts.actions.find((item) => !usedCustomerSourceTexts.has(item.text));
    if (actionSource) usedCustomerSourceTexts.add(actionSource.text);
    const result = adapterFact(
      `adapter:${definition.id}`,
      factBomb,
      chapterEvidence,
      {
        interpretation: interpretationSource?.text ?? fallback.interpretation,
        realLifeScene: realLifeSource?.text ?? fallback.realLifeScene,
        counterpoint: fallback.counterpoint,
        checkSignal: fallback.checkSignal,
        action: actionSource?.text ?? fallback.action,
      },
    );
    return {
      id: definition.id,
      order: index + 1,
      title: definition.title,
      result,
      derivedFacts: [{
        id: `derived:${definition.id}`,
        kind: definition.id === 'twelve-month-timing' ? 'timing' : definition.id === 'communication-pattern' ? 'communication' : definition.id === 'lasting-partner' ? 'stability' : 'attraction',
        statement: factBomb,
        evidence: evidenceFromExactSource(sajuSummary.evidence, factSource?.sourcePath),
        confidence: report.engineMeta?.confidence ?? 0.65,
        uncertainty: sajuSummary.uncertainty[0],
      }],
      sceneKey: definition.sceneKey,
      layout: definition.layout,
      locked: false,
    };
  });
  const attractedPartner = partnerTendency('빠르게 끌릴 수 있는 분위기', [], false);
  const lastingPartner = partnerTendency('오래 갈 가능성을 확인할 행동', [], true);
  const actionPlan = {
    stop: ['답장 속도 하나로 결론 내리기', '관계를 확인하려고 일부러 밀어내기', '합의 없는 기다림을 계속하기'],
    start: ['원하는 관계를 짧게 말하기', '말과 행동을 분리해 기록하기', '불편한 질문을 차분히 확인하기'],
    check: ['약속을 구체화하는가', '변경 시 대안을 제시하는가', '경계를 존중하는가'],
    thirtyDays: [
      { week: 1 as const, title: '패턴 기록', task: '감정이 흔들린 장면과 실제 행동을 나눠 적기' },
      { week: 2 as const, title: '말과 행동 분리', task: '약속·연락·만남의 일관성 확인하기' },
      { week: 3 as const, title: '질문하기', task: '원하는 관계와 속도를 직접 묻기' },
      { week: 4 as const, title: '판단하기', task: '계속할 관계와 멈출 관계의 기준 적용하기' },
    ],
  };
  const openingFact = adapterFact('adapter:opening', chapters[0].result.factBomb, chapters[0].result.evidence, {
    interpretation: chapters[0].result.interpretation,
    realLifeScene: chapters[0].result.realLifeScene,
    action: chapters[0].result.action,
  });
  return {
    meta: { id: `mz-love:${report.serialNumber}`, version: 'mz-love-fact-v1', createdAt: report.createdAt, sourceReportSerial: report.serialNumber },
    user: { displayName: report.customerName && report.customerName !== '고객' ? report.customerName : '당신', relationshipStatus: status, birthTimeKnown: sajuSummary.birthTimeKnown },
    sajuSummary,
    openingFact,
    loveSelf: chapters[0].result,
    repeatedPattern: chapters[1].result,
    attractedPartner,
    lastingPartner,
    attractionComparison: { attracted: attractedPartner, lasting: lastingPartner, decisiveCheck: '3주 동안 약속·연락·만남의 일관성을 비교하세요.' },
    nextPartner: lastingPartner,
    meetingScenes: ['반복해서 방문하는 생활 반경', '업무·학습·취미처럼 대화가 이어지는 자리', '신뢰할 수 있는 사람을 통한 소개'],
    twelveMonthTiming: report.monthLuck.slice(0, 12).map((item) => ({
      id: `month:${item.year}-${item.month}`,
      periodLabel: `${item.year}년 ${item.month}월`,
      temperature: item.score,
      flow: '계산 점수는 만남과 대화의 선택지를 조절하는 참고 신호로 활용합니다.',
      caution: '특정 사건이나 상대의 행동을 확정하지 않습니다.',
      action: item.focus || '새로운 접점을 한 번 늘리고 실제 반응을 기록하세요.',
      evidence: [],
      conditional: true,
    })),
    communicationPattern: chapters[8].result,
    relationshipStatusBranch: chapters[9].result,
    redFlags: ['관계 정의를 계속 미루면서 책임도 피함', '약속 변경 뒤 대안을 제시하지 않음', '경계를 말했을 때 비난하거나 무시함'],
    greenFlags: ['말과 행동의 방향이 비슷함', '불편한 대화 뒤에도 관계를 회복하려 함', '서로의 시간과 경계를 존중함'],
    actionPlan,
    finalFact: chapters[12].result,
    chapters,
    shareCards: ['설렘보다 행동을 본다', '평온함을 지루함으로 오해하지 않는다'],
    recommendations: ['30일 행동 플랜 저장', '관계의 말과 행동을 주 1회 비교'],
    disclaimers: [
      '이 결과는 명리 신호를 바탕으로 관계 패턴을 성찰하도록 돕는 참고 콘텐츠입니다.',
      '미래 사건이나 상대의 속마음을 확정하지 않으며, 중요한 관계 결정은 실제 대화와 행동을 함께 확인하세요.',
      ...sajuSummary.uncertainty,
    ],
  };
}

function isMzLoveReport(report: MzLoveReport | SajuReportData): report is MzLoveReport {
  return 'meta' in report && report.meta?.version === 'mz-love-fact-v1';
}

const SAFE_RED_FLAGS = [
  '관계에 대한 질문은 피하면서 필요할 때만 연락한다',
  '약속을 반복해서 미루고도 구체적인 대안을 만들지 않는다',
  '서운함을 말했을 때 대화보다 네 예민함을 문제 삼는다',
] as const;

const SAFE_GREEN_FLAGS = [
  '말한 약속을 작은 것부터 꾸준히 지킨다',
  '불편한 대화 뒤에도 연락을 끊지 않고 해결을 시도한다',
  '좋아한다는 말과 실제 시간 배분이 같은 방향을 향한다',
] as const;

const SAFE_ACTION_PLAN: MzLoveActionPlan = {
  stop: [
    '답장 속도 하나로 상대의 마음을 결론 내리지 않기',
    '관계를 확인하려고 일부러 연락을 끊거나 밀어내지 않기',
    '합의 없이 기다리는 시간을 계속 늘리지 않기',
  ],
  start: [
    '내가 원하는 관계와 연락 방식을 짧게 말하기',
    '상대의 말과 실제 행동을 나눠서 기록하기',
    '불편한 질문도 비난 없이 차분하게 확인하기',
  ],
  check: [
    '상대가 다음 약속을 구체적으로 만드는지 확인하기',
    '약속이 바뀌면 새로운 대안을 먼저 제시하는지 보기',
    '내 시간과 감정의 경계를 존중하는지 살펴보기',
  ],
  thirtyDays: [
    { week: 1, title: '내 패턴 기록', task: '마음이 흔들린 장면과 확인된 사실을 나눠 적기' },
    { week: 2, title: '말과 행동 비교', task: '약속·연락·만남이 같은 방향으로 이어지는지 보기' },
    { week: 3, title: '필요한 질문', task: '원하는 관계와 서로 편한 속도를 직접 묻기' },
    { week: 4, title: '관계 선택', task: '계속 볼 신호와 멈출 신호를 실제 행동에 적용하기' },
  ],
};

function safeNarrativeList(values: readonly string[], fallbacks: readonly string[], limit = fallbacks.length): string[] {
  const safeValues = values.filter((value) => isCustomerNarrativeText(value)).map(normalizeCopy);
  return [...new Set([...safeValues, ...fallbacks])].slice(0, limit);
}

function safeActionPlan(plan: MzLoveActionPlan): MzLoveActionPlan {
  const safeThirtyDays = plan.thirtyDays
    .filter((mission) => isCustomerNarrativeText(mission.task))
    .map((mission) => ({ ...mission, task: normalizeCopy(mission.task) }));
  const fallbackByWeek = new Map(SAFE_ACTION_PLAN.thirtyDays.map((mission) => [mission.week, mission]));
  const byWeek = new Map(safeThirtyDays.map((mission) => [mission.week, mission]));

  return {
    stop: safeNarrativeList(plan.stop, SAFE_ACTION_PLAN.stop, 3),
    start: safeNarrativeList(plan.start, SAFE_ACTION_PLAN.start, 3),
    check: safeNarrativeList(plan.check, SAFE_ACTION_PLAN.check, 3),
    thirtyDays: ([1, 2, 3, 4] as const).map((week) => byWeek.get(week) ?? fallbackByWeek.get(week)!),
  };
}

function exactInterpretationEvidence(
  evidence: readonly EvidenceTag[],
  sourceInterpretation: string,
  displayedInterpretation: string,
): EvidenceTag[] {
  if (sourceInterpretation !== displayedInterpretation) return [];
  return evidence.filter((item) => (
    Boolean(item.sourcePath)
    && item.value === sourceInterpretation
    && item.description === sourceInterpretation
  ));
}

export function buildMzLoveViewModel(report: MzLoveReport): MzLoveReportViewModel;
export function buildMzLoveViewModel(
  report: SajuReportData,
  options?: { relationshipStatus?: RelationshipStatus; birthTimeKnown?: boolean },
): MzLoveReportViewModel;
export function buildMzLoveViewModel(
  source: MzLoveReport | SajuReportData,
  options: { relationshipStatus?: RelationshipStatus; birthTimeKnown?: boolean } = {},
): MzLoveReportViewModel {
  const report = isMzLoveReport(source) ? source : buildMzLoveReportFromSaju(source, options);
  const sceneByChapter = resolveMzLoveChapterScenes(report.chapters, report.user.relationshipStatus);
  const chapters = [...report.chapters]
    .sort((left, right) => left.order - right.order)
    .map((chapter) => {
      const definition = ADAPTER_CHAPTERS.find((item) => item.id === chapter.id);
      const statusCopy = chapter.id === 'relationship-status'
        ? RELATIONSHIP_STATUS_CHAPTER_COPY[report.user.relationshipStatus]
        : null;
      const fallback = statusCopy ?? CHAPTER_FALLBACK_COPY[chapter.id];
      const resolved = sceneByChapter.get(chapter.id) ?? null;
      const explicit = chapter.sceneKey ? getMzLoveScene(chapter.sceneKey) : null;
      const scene = resolved ?? explicit;
      const defaultFactBomb = definition?.factBomb
        ?? '감정의 크기보다 관계를 만드는 실제 행동을 확인해.';
      const excludedValues = new Set(
        [chapter.title, report.user.primaryQuestion]
          .filter((value): value is string => Boolean(value))
          .map(normalizeCopy),
      );
      const factBomb = statusCopy?.factBomb
        ?? customerFacingChapterField(chapter.result.factBomb, defaultFactBomb, chapter.id, excludedValues);
      const interpretation = statusCopy?.interpretation
        ?? customerFacingChapterField(chapter.result.interpretation, fallback.interpretation, chapter.id, excludedValues);
      return {
        id: chapter.id,
        order: chapter.order,
        eyebrow: CHAPTER_EYEBROWS[chapter.id],
        title: definition?.title ?? chapter.title,
        subtitle: isChapterCustomerNarrativeText(chapter.subtitle, chapter.id, excludedValues) ? normalizeCopy(chapter.subtitle) : undefined,
        factBomb,
        interpretation,
        evidence: statusCopy
          ? []
          : exactInterpretationEvidence(chapter.result.evidence, chapter.result.interpretation, interpretation),
        realLifeScene: statusCopy?.realLifeScene
          ?? customerFacingChapterField(chapter.result.realLifeScene, fallback.realLifeScene, chapter.id, excludedValues),
        counterpoint: statusCopy?.counterpoint
          ?? customerFacingChapterField(chapter.result.counterpoint, fallback.counterpoint, chapter.id, excludedValues),
        checkSignal: statusCopy?.checkSignal
          ?? customerFacingChapterField(chapter.result.checkSignal, fallback.checkSignal, chapter.id, excludedValues),
        action: statusCopy?.action
          ?? customerFacingChapterField(chapter.result.action, fallback.action, chapter.id, excludedValues),
        characterLine: statusCopy?.factBomb
          ?? customerFacingChapterField(chapter.result.characterLine.text, factBomb, chapter.id, excludedValues),
        scene,
        locked: chapter.locked,
        layout: chapter.layout,
      };
    });

  const evidenceIds = new Set(chapters.flatMap((chapter) => chapter.evidence.map((item) => item.id)));
  const redFlags = safeNarrativeList(report.redFlags, SAFE_RED_FLAGS, 3);
  const greenFlags = safeNarrativeList(report.greenFlags, SAFE_GREEN_FLAGS, 3);
  const actionPlan = safeActionPlan(report.actionPlan);
  const disclaimers = [
    '이 결과는 관계 패턴을 돌아보는 참고 콘텐츠이며 상대의 속마음이나 미래 사건을 확정하지 않습니다.',
    '중요한 관계 선택은 실제 대화와 반복되는 행동, 서로의 안전과 경계를 함께 확인하세요.',
    ...(report.sajuSummary.birthTimeKnown ? [] : ['출생시간이 없어 세부 연애 시기는 넓은 범위로 읽었습니다.']),
  ];
  return {
    cover: {
      title: `${report.user.displayName}의 팩폭 연애운`,
      subtitle: '끌리는 사람, 오래 갈 사람, 다음 사랑을 확인하는 기준',
      eyebrow: '운월당 MZ무당 상담록',
      relationshipLabel: RELATIONSHIP_LABELS[report.user.relationshipStatus],
      keywords: ['관계 기준', '감정 리듬', '행동 신호'],
      evidenceCount: evidenceIds.size,
      createdAt: report.meta.createdAt,
    },
    chapters,
    redFlags,
    greenFlags,
    actionPlan,
    disclaimers,
    progress: {
      completed: chapters.filter((chapter) => !chapter.locked).length,
      total: chapters.length,
    },
  };
}

export const buildMzLoveReportViewModel = buildMzLoveViewModel;
