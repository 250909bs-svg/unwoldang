import type { ReportDetail, ReportSection, SajuReportData } from '../../lib/saju/report';
import {
  PAST_LIFE_PRODUCT_ID,
  PAST_LIFE_REPORT_VOLUMES,
  formatPastLifeReportTopic,
  type PastLifeVolumeContract
} from './contract';
import { sanitizePastLifeReportForRendering } from './reportSafety';

const ENGINE_EVIDENCE_SECTION_IDS = new Set([
  'calculation-audit-v2',
  'expert-evidence-v2',
  'temporal-evidence-v2',
  'compatibility-evidence-v2'
]);

const PAST_LIFE_NOTICE =
  '전생 서사는 사주 원국의 반복 성향을 이해하기 위한 상징적 콘텐츠이며, 과거 생애의 실재를 증명하거나 특정 인물·사건을 확정하지 않습니다.';

function makeDetail(number: number, content: string, open = false): ReportDetail {
  return {
    summary: formatPastLifeReportTopic(number),
    content,
    ...(open ? { open: true } : {})
  };
}

function makeVolumeSection(
  volume: PastLifeVolumeContract,
  details: ReportDetail[],
  extra: Pick<ReportSection, 'callout'> = {}
): ReportSection {
  return {
    id: volume.sectionId,
    title: `${volume.volume} ${volume.title}`,
    subtitle: volume.line,
    ...extra,
    details
  };
}

function buildProductQuestionAnswers(report: SajuReportData) {
  const focusSentence =
    '전생은 검증된 사실로 단정하지 않고, 원국에 반복해서 남은 기질과 현재 대운이 만드는 생활 장면을 상징적으로 연결해 읽습니다.';

  return report.questionAnswers.map((qa, index) => ({
    ...qa,
    title: `도깨비 전생사주 질문 ${index + 1}: ${qa.title
      .replace(/^첫 번째 질문 핵심 판정:\s*|^두 번째 질문 핵심 판정:\s*/, '')
      .replace(/^\d+\.\s*/, '')}`,
    analysis: `${qa.analysis} ${focusSentence}`,
    advice: [
      ...qa.advice.slice(0, 2),
      '결론을 확정처럼 받아들이기보다, 7일 안에 확인 가능한 행동 하나로 현실 반응을 보세요.'
    ]
  }));
}

const PAST_LIFE_DETAIL_NUMBER = /^\s*(\d{2})\.\s*/u;

function getLeadingTopicNumber(summary: string) {
  const match = summary.match(PAST_LIFE_DETAIL_NUMBER);
  return match ? Number.parseInt(match[1], 10) : null;
}

function isCompleteVolumeSection(section: ReportSection, volume: PastLifeVolumeContract) {
  return (
    section.id === volume.sectionId &&
    section.details?.length === volume.topics.length &&
    section.details.every(
      (detail, index) =>
        getLeadingTopicNumber(detail.summary) === volume.topics[index].number &&
        detail.content.trim().length > 0
    )
  );
}

/**
 * Existing paid or archived reports are authoritative when all five volumes and
 * their 26 entries are already present. Their generated prose must not be
 * replaced merely because this builder runs again.
 */
export function hasCompletePastLifeGoblinReport(report: SajuReportData) {
  if (report.serviceId !== PAST_LIFE_PRODUCT_ID) return false;

  const matchingSections = PAST_LIFE_REPORT_VOLUMES.map((volume) =>
    report.sections.filter((section) => section.id === volume.sectionId)
  );

  if (matchingSections.some((matches) => matches.length !== 1)) return false;

  const orderedIndices = matchingSections.map(([section]) => report.sections.indexOf(section));
  const hasContractOrder = orderedIndices.every(
    (sectionIndex, index) => index === 0 || orderedIndices[index - 1] < sectionIndex
  );

  return (
    hasContractOrder &&
    matchingSections.every(([section], index) =>
      isCompleteVolumeSection(section, PAST_LIFE_REPORT_VOLUMES[index])
    )
  );
}

/**
 * Builds the five-volume symbolic narrative while retaining immutable engine
 * evidence. It is intentionally a no-op for other products and for complete
 * past-life reports so stored or AI-enriched prose remains unchanged.
 */
export function buildPastLifeGoblinReport(report: SajuReportData): SajuReportData {
  if (report.serviceId !== PAST_LIFE_PRODUCT_ID || hasCompletePastLifeGoblinReport(report)) {
    return report;
  }

  const dominantTenGods = [...report.tenGods]
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map((item) => item.label)
    .join('·');
  const missingElements = report.fiveElements
    .filter((item) => item.value === 0)
    .map((item) => item.label);
  const missingElementText = missingElements.length
    ? `${missingElements.join('·')} 기운이 비어 있는 자리`
    : '오행이 고르게 놓인 자리';
  const helpfulText = report.helpfulElements.length
    ? report.helpfulElements.join('·')
    : '보완 기운';
  const sealNameByElement = {
    목: '길을 숨긴 문지기',
    화: '불을 감춘 기록관',
    토: '무너진 터를 지킨 사람',
    금: '이름을 새긴 재판관',
    수: '밤길을 건넌 전령'
  } as const;
  const sealName = sealNameByElement[report.dayMasterElement];
  const basisLine = `${report.dayMaster} 일간, ${report.gyeokguk}, ${
    dominantTenGods || '십성 분포'
  }, ${missingElementText}`;
  const [sealVolume, relationshipVolume, karmaVolume, presentVolume, releaseVolume] =
    PAST_LIFE_REPORT_VOLUMES;

  const sealChapter = makeVolumeSection(
    sealVolume,
    [
      makeDetail(
        1,
        `${report.customerName}님의 봉인명은 “${sealName}”입니다. 남의 문제를 먼저 알아차리고 정리하는 능력과, 정작 자기 요구는 뒤로 미루는 습관이 함께 보입니다. 오늘의 해원 행동은 부탁을 받자마자 답하지 않고 내 일정부터 확인하는 것입니다.`,
        true
      ),
      makeDetail(
        2,
        `장부의 상징 인물은 권력을 휘두르는 영웅보다 기록과 판단을 맡았던 실무자로 그려집니다. ${report.dayMaster} 일간의 중심성과 ${
          dominantTenGods || '십성'
        }의 작동이 이 상징을 만듭니다. 현생에서도 회의나 관계가 꼬이면 결국 정리하는 사람이 되기 쉽습니다.`
      ),
      makeDetail(
        3,
        '특정 왕조나 지역을 사실로 단정하지 않습니다. 앞의 인물 장부에 표시된 장소는 원국의 기질을 공간으로 번역한 상징 무대입니다. 사람과 돈, 약속이 오가지만 어느 편에도 완전히 속하지 못한 자리라는 공통점이 있습니다. 현생에서는 조직 안팎을 연결하는 역할에서 같은 익숙함이 나타날 수 있습니다.'
      ),
      makeDetail(
        4,
        '앞의 인물 장부에 표시된 역할은 권력 그 자체보다 사람, 물건, 소식, 약속을 연결하고 정리하는 실무에 가깝습니다. 능력은 있었지만 책임 범위가 흐려 손해를 떠안았다는 상징이 남습니다.'
      ),
      makeDetail(
        5,
        `복잡한 정보를 빠르게 분류하고, 사람마다 다른 이해관계를 한 문장으로 정리하는 재능입니다. ${helpfulText} 기운을 생활에서 쓸수록 이 능력이 소진이 아니라 결과물로 남습니다. 무료 도움과 유료 결과물을 구분하는 것이 현생의 사용법입니다.`
      )
    ],
    {
      callout: {
        title: `상징 봉인명 · ${sealName}`,
        body: `${basisLine}를 상징 언어로 번역한 이름입니다. 역사적 신원이나 실제 과거 생애를 뜻하지 않습니다.`
      }
    }
  );

  const relationshipChapter = makeVolumeSection(relationshipVolume, [
    makeDetail(
      6,
      '말이 많고 화려한 사람보다 약속을 조용히 지키는 사람에게 마음을 내어준 서사입니다. 연인·동료·가족 중 하나로 단정하지 않으며, 현생에서도 처음의 설렘보다 반복 행동에서 신뢰를 느끼는 관계 유형을 보여줍니다.',
      true
    ),
    makeDetail(
      7,
      '처음부터 설명을 생략해도 통할 것 같은 익숙함으로 나타날 수 있습니다. 그러나 익숙함은 안전의 증거가 아닙니다. 연락 간격, 돈 쓰는 태도, 갈등 뒤 돌아오는 말투를 세 번 이상 확인한 뒤 관계의 이름을 정하세요.'
    ),
    makeDetail(
      8,
      '노골적으로 해치는 사람보다 책임을 나누겠다고 말한 뒤 결정적인 순간에 빠지는 사람에게 특히 크게 상처받는 패턴입니다. 현생에서는 공동 작업과 연애 모두 “같이 하자”는 말보다 실제 분담표를 먼저 확인해야 합니다.'
    ),
    makeDetail(
      9,
      '악인을 지목하는 이야기가 아니라 서로의 침묵을 오해한 관계의 상징입니다. 한쪽은 기다렸고 다른 쪽은 이미 끝났다고 생각했습니다. 현생에서는 불편함을 오래 저장하지 말고 “나는 이 지점이 어렵다”는 한 문장을 먼저 꺼내야 같은 매듭을 만들지 않습니다.'
    )
  ]);

  const karmaChapter = makeVolumeSection(karmaVolume, [
    makeDetail(
      10,
      '여기서 업은 저주나 형벌이 아니라 외면했던 책임의 반복을 뜻합니다. 틀린 것을 알고도 관계가 깨질까 침묵했고, 일이 커진 뒤 혼자 수습한 장면입니다. 현생에서는 작은 오류를 초기에 말하는 것이 가장 현실적인 해원입니다.',
      true
    ),
    makeDetail(
      11,
      '돈의 액수보다 정당한 대가를 포기한 선택의 상징입니다. 도움을 주고도 값을 말하지 못해 서운함이 쌓였습니다. 지금은 가격, 수정 횟수, 마감일을 먼저 적어야 같은 부채가 생기지 않습니다.'
    ),
    makeDetail(
      12,
      '누군가를 끝까지 지키겠다는 약속 때문에 자기 삶의 시기를 놓친 서사입니다. 현생에서 “내가 아니면 안 된다”는 부탁을 받을 때 특히 조심하세요. 도움의 끝나는 날짜를 정하는 것이 약속을 건강하게 지키는 방식입니다.'
    ),
    makeDetail(
      13,
      '진실을 말할지 관계를 지킬지 선택해야 했던 상징 장면입니다. 관계를 택했지만 결국 둘 다 잃었다는 패턴으로 읽습니다. 지금은 중요한 사실을 감정이 폭발하기 전에 짧게 공유하는 연습이 필요합니다.'
    ),
    makeDetail(
      14,
      '더 용감하지 못한 것이 아니라, 필요한 말을 너무 늦게 한 후회로 그려집니다. 현생에서는 완벽한 문장을 준비하느라 타이밍을 놓치지 마세요. 사실, 요청, 기한 세 가지만 말해도 충분합니다.'
    ),
    makeDetail(
      15,
      '장부에 남은 문장은 “나도 지쳤다”입니다. 강한 사람으로 보이려다 도움을 청하지 못한 흔적을 상징합니다. 이번 주 안에 믿을 만한 한 사람에게 해결책이 아니라 현재 상태를 먼저 알려보세요.'
    )
  ]);

  const presentChapter = makeVolumeSection(presentVolume, [
    makeDetail(
      16,
      `일이 어긋난 것을 빨리 발견하지만 바로 말하지 않고, 결국 마지막에 책임을 떠안는 패턴입니다. ${report.currentDayun.name} 대운에서는 이 습관이 돈과 체력을 동시에 소모시킬 수 있습니다. 문제를 발견한 날 기록으로 남기세요.`,
      true
    ),
    makeDetail(
      17,
      '좋아할수록 요구를 줄이고 상대를 이해하려다, 어느 순간 마음을 닫는 장면입니다. 배려보다 확인이 먼저입니다. 보고 싶은 날짜, 필요한 연락 간격, 힘든 말투를 구체적으로 말해야 관계가 오래 갑니다.'
    ),
    makeDetail(
      18,
      '남들이 어려워하는 일을 해결하지만 가격을 뒤늦게 말해 수익보다 피로가 커질 수 있습니다. 업무 시작 전에 결과물, 일정, 수정 범위, 정산일을 고정하면 재능이 수입으로 남습니다.'
    ),
    makeDetail(
      19,
      '가족이나 가까운 사람의 감정을 먼저 관리하는 역할을 맡기 쉽습니다. 하지만 상대의 기분과 내 책임은 다릅니다. 도울 수 있는 것 한 가지와 할 수 없는 것 한 가지를 함께 말하세요.'
    ),
    makeDetail(
      20,
      `${dominantTenGods || '십성'}의 장점은 설명, 중재, 분석, 기록을 실제 결과로 바꾸는 힘입니다. 단번에 주목받기보다 신뢰가 쌓일수록 가치가 커집니다. 하나의 대표 결과물을 오래 다듬는 방식이 맞습니다.`
    )
  ]);

  const releaseChapter = makeVolumeSection(
    releaseVolume,
    [
      makeDetail(
        21,
        '도움을 당연하게 여기고, 책임이 생기면 설명 없이 빠지는 관계 패턴입니다. 강한 끌림보다 약속 이행을 보세요. 두 번 연속 일정과 책임을 미루는 사람에게 세 번째 기회를 자동으로 주지 않는 것이 기준입니다.',
        true
      ),
      makeDetail(
        22,
        '화려한 말을 하는 사람보다 역할과 대가를 분명히 해주는 사람입니다. 불편한 사실을 예의 있게 말하고, 당신이 쉬는 시간을 존중하는 사람이 기회를 오래 남깁니다.'
      ),
      makeDetail(
        23,
        '모든 것을 내가 수습해야 끝난다는 믿음을 내려놓는 것입니다. 능력을 증명하기 위해 과도한 책임을 맡지 마세요. 역할이 흐리면 시작 전에 다시 묻는 것이 이번 생의 새로운 선택입니다.'
      ),
      makeDetail(
        24,
        '의식이나 부적이 아니라 반복 행동을 바꾸는 방식입니다. 즉답을 하루 늦추고, 돈과 시간이 오가는 일은 문자로 남기고, 불편함이 작을 때 말하세요. 세 가지를 30일 유지하면 생활의 결과가 달라집니다.'
      ),
      makeDetail(
        25,
        `1주차에는 반복 장면을 기록하고, 2주차에는 책임 경계를 한 문장으로 정합니다. 3주차에는 잘하는 일 하나에 가격과 범위를 붙이고, 4주차에는 ${helpfulText} 기운을 살리는 수면·기록·일정 습관 하나를 고정합니다.`
      ),
      makeDetail(
        26,
        '상징 인물은 이렇게 말합니다. “나는 오래도록 남의 이름을 지키느라 내 이름을 뒤로 미뤘다. 너는 그러지 않아도 된다. 필요한 말을 제때 하고, 네가 만든 가치에 값을 붙이고, 떠나야 할 관계 앞에서 미안함을 의무로 착각하지 마라.”'
      )
    ],
    {
      callout: {
        title: '봉인이 풀리는 문장',
        body: '상징 서사에 그려진 오래된 선택은, 지금의 작은 행동을 바꾸는 순간부터 반복을 멈출 수 있습니다.'
      }
    }
  );

  const evidenceSections = report.sections.filter((section) =>
    ENGINE_EVIDENCE_SECTION_IDS.has(section.id)
  );

  return {
    ...report,
    title: '도깨비 전생장부: 봉인록',
    subtitle: '사주 원국의 반복 기질을 다섯 권 26개 주제와 현생의 행동으로 연결한 개인 전생장부',
    badge: `상징 봉인명 · ${sealName}`,
    heroNote: `${report.customerName}님의 전생 이야기는 미래를 겁주는 예언이 아닙니다. ${report.dayMaster} 일간과 ${
      dominantTenGods || '십성'
    }의 반복 장면을 통해, 왜 비슷한 사람과 일 앞에서 같은 선택을 하는지 알아보는 상징적 거울에 가깝습니다.`,
    summary: {
      title: `${report.customerName}님의 봉인 전 핵심 판정`,
      analysis: [
        `${report.dayMaster} 일간, ${report.pillars.month} 월주, ${report.gyeokguk}과 ${
          dominantTenGods || '십성 분포'
        }를 함께 보면, 남들이 지나친 문제를 먼저 알아차리고 정리하는 힘이 앞에 있습니다. 반면 책임의 끝을 정하지 않으면 능력이 성과보다 뒷수습으로 소모되기 쉽습니다.`,
        `${missingElementText}는 부족함을 겁주는 표지가 아니라 의식적으로 길러야 할 생활 감각을 보여줍니다. 이 장부에서 화는 차가운 금수의 한기를 데우는 조후의 온도로, 토는 흩어진 생각과 관계를 일정·가격·책임 범위에 담는 현실의 그릇으로 분리해 읽습니다.`,
        `현재 ${report.currentDayun.name} 대운에서는 익숙한 사람과 일보다 실제로 약속을 지키는 사람, 대가와 범위가 보이는 일을 고르는 편이 중요합니다. 전생 서사는 이 선택 습관을 기억에 남게 보여주는 상징이며, 역사적 신원이나 초자연적 사실을 확정하는 문서가 아닙니다.`
      ],
      advice: [
        '부탁을 받은 자리에서 바로 답하지 말고 일정과 책임 범위를 먼저 확인합니다.',
        '돈과 시간이 오가는 일은 가격, 정산일, 수정 횟수를 시작 전에 기록합니다.',
        '관계의 익숙함보다 약속 이행과 갈등 뒤 회복 행동을 세 번 이상 관찰합니다.',
        `30일 동안 ${helpfulText} 기운을 생활에서 쓰는 한 가지 습관을 정해 기록합니다.`
      ]
    },
    keyTakeaways: [
      {
        title: '상징 캐릭터',
        body: '복잡한 판을 읽고 사람과 자원을 정리하던 실무형 조력자의 상징이 강합니다.',
        tone: 'good'
      },
      {
        title: '남겨진 재능',
        body: '설명, 중재, 기록, 분석처럼 보이지 않는 문제를 형태로 만드는 능력이 남아 있습니다.'
      },
      {
        title: '반복되는 업',
        body: '남의 책임까지 떠안은 뒤 한꺼번에 지쳐 관계와 일을 끊는 장면을 조심해야 합니다.',
        tone: 'warn'
      },
      {
        title: '현생 미션',
        body: '도움과 희생을 구분하고, 내 재능에 범위와 값을 붙이는 것이 이번 생의 핵심 과제입니다.'
      }
    ],
    questionAnswers: buildProductQuestionAnswers(report),
    sections: [
      ...evidenceSections,
      sealChapter,
      relationshipChapter,
      karmaChapter,
      presentChapter,
      releaseChapter
    ],
    actionPlan: {
      ...report.actionPlan,
      title: '30일 현생 미션',
      priorities: [
        '1주차: 반복해서 지치는 사람, 일, 돈 장면을 각각 하나씩 적습니다.',
        '2주차: 내 책임과 상대 책임의 경계를 한 문장으로 정합니다.',
        '3주차: 당연하게 제공하던 재능 하나에 결과물과 가격을 붙입니다.',
        '4주차: 이전과 다른 선택을 한 장면을 기록하고 다음 달에도 유지할 규칙 하나를 남깁니다.'
      ],
      dos: [
        '익숙함보다 실제 행동이 안정적인 사람을 선택하기',
        '부탁을 받으면 즉답하지 않고 시간과 범위를 먼저 확인하기',
        '감정이 닫히기 전에 불편한 지점을 짧게 말하기',
        '잘하는 일을 무료 도움과 유료 결과물로 구분하기'
      ],
      avoids: [
        '전생 이야기만으로 현실의 사람과 사건을 확정하는 것',
        '미안함 때문에 내 일정과 돈을 무제한으로 내어주는 것',
        '말하지 않고 참다가 관계를 한 번에 끊는 것',
        '상징적인 해석을 의료, 법률, 투자 판단의 근거로 사용하는 것'
      ]
    },
    legalNotice: report.legalNotice.includes(PAST_LIFE_NOTICE)
      ? report.legalNotice
      : [...report.legalNotice, PAST_LIFE_NOTICE]
  };
}

export function ensurePastLifeGoblinReport(report: SajuReportData): SajuReportData {
  return sanitizePastLifeReportForRendering(buildPastLifeGoblinReport(report));
}
