import type { PastLifeProfile, ReportDetail, SajuReportData } from '../../lib/saju/report';
import { sanitizePastLifeNarrative } from './contentSafety';
import {
  PAST_LIFE_NARRATIVE_POLICY,
  PAST_LIFE_PRODUCT_ID,
  PAST_LIFE_REPORT_VOLUMES,
  type PastLifeVolumeId
} from './contract';
import {
  getPastLifeWebtoonScene,
  type PastLifeWebtoonSceneArtwork
} from './sceneManifest';
import {
  PAST_LIFE_WEBTOON_VOLUMES,
  getPastLifeFocusVolumeId,
  type PastLifeWebtoonCropPosition
} from './webtoonContract';

export const PAST_LIFE_READING_STEP_IDS = [
  'symbolic-scene',
  'repeated-trait',
  'other-possibility',
  'present-check',
  'today-action'
] as const;

export type PastLifeReadingStepId = (typeof PAST_LIFE_READING_STEP_IDS)[number];

export type PastLifeWebtoonEvidenceSource =
  | 'natal-chart'
  | 'ten-god'
  | 'timing'
  | 'customer-input';

export type PastLifeWebtoonEvidence = {
  id: string;
  label: string;
  value: string;
  description: string;
  source: PastLifeWebtoonEvidenceSource;
  sourcePath: string;
  confidence?: number;
  uncertainty?: string;
};

export type PastLifeWebtoonTopic = {
  number: number;
  title: string;
  content: string;
};

export type PastLifeWebtoonDialogue = {
  speaker: '도깨비 장부지기';
  line: string;
  side: 'left' | 'right';
};

export type PastLifeWebtoonPanelViewModel = {
  id: string;
  order: 1 | 2 | 3;
  cropPosition: PastLifeWebtoonCropPosition;
  label: string;
  symbolic: true;
  artwork: PastLifeWebtoonSceneArtwork;
  narration: string;
  dialogue: PastLifeWebtoonDialogue;
  topics: readonly PastLifeWebtoonTopic[];
};

export type PastLifeReadingStep = {
  id: PastLifeReadingStepId;
  label: '상징장면' | '반복기질' | '다른가능성' | '현생확인' | '오늘행동';
  value: string;
};

export type PastLifeWebtoonVolumeViewModel = {
  id: PastLifeVolumeId;
  order: 1 | 2 | 3 | 4 | 5;
  sectionId: `pastlife-${PastLifeVolumeId}`;
  volume: string;
  title: string;
  line: string;
  symbol: string;
  isFocused: boolean;
  panels: readonly PastLifeWebtoonPanelViewModel[];
  readingSteps: readonly PastLifeReadingStep[];
  evidence: readonly PastLifeWebtoonEvidence[];
};

export type PastLifeWebtoonViewModel = {
  title: string;
  subtitle: string;
  openingLine: string;
  notice: string;
  disclaimer: string;
  focus: {
    label: string;
    volumeId: PastLifeVolumeId;
  };
  birthTimeKnown: boolean;
  limitation: string | null;
  volumes: readonly PastLifeWebtoonVolumeViewModel[];
};

const PANEL_LABELS = ['봉인이 열리는 장면', '선택이 흔들리는 장면', '현생으로 이어지는 장면'] as const;

const VOLUME_EVIDENCE_IDS: Record<PastLifeVolumeId, readonly string[]> = {
  seal: ['day-master', 'month-pillar', 'dominant-ten-god'],
  relationship: ['dominant-ten-god', 'customer-scene', 'customer-emotion'],
  karma: ['cautious-elements', 'customer-emotion', 'customer-scene'],
  present: ['current-dayun', 'day-master', 'customer-scene'],
  release: ['helpful-elements', 'customer-desire', 'current-dayun']
};

function safeNarrative(value: string | null | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  const sanitized = sanitizePastLifeNarrative(candidate).trim();

  if (sanitized) return sanitized;
  return sanitizePastLifeNarrative(fallback).trim();
}

const PAST_LIFE_DETAIL_NUMBER = /^\s*(\d{2})\.\s*/u;

function getLeadingTopicNumber(summary: string) {
  const match = summary.match(PAST_LIFE_DETAIL_NUMBER);
  return match ? Number.parseInt(match[1], 10) : null;
}

function getTopicTitle(summary: string, fallback: string) {
  return safeNarrative(summary.replace(PAST_LIFE_DETAIL_NUMBER, '').trim(), fallback);
}

function findTopicDetail(
  details: readonly ReportDetail[],
  topicNumber: number,
  topicIndex: number
) {
  const numberedDetail = details.find(
    (detail) => getLeadingTopicNumber(detail.summary) === topicNumber
  );

  if (numberedDetail) return numberedDetail;

  const legacyDetail = details[topicIndex];
  return legacyDetail && getLeadingTopicNumber(legacyDetail.summary) === null
    ? legacyDetail
    : undefined;
}

function isUnknownBirthTime(report: SajuReportData) {
  const hour = report.pillars.hour?.trim() ?? '';
  return (
    !hour ||
    /미상|모름|unknown/iu.test(hour) ||
    report.engineMeta?.calculationPrecision === 'unknown'
  );
}

function makeEvidenceCatalog(
  report: SajuReportData,
  profile: PastLifeProfile,
  limitation: string | null
) {
  const dominantTenGod = report.tenGods
    .map((item, index) => ({ ...item, index }))
    .sort((left, right) => right.value - left.value)[0];
  const engineConfidence = report.engineMeta?.confidence;
  const engineFields = (evidence: PastLifeWebtoonEvidence): PastLifeWebtoonEvidence => ({
    ...evidence,
    ...(typeof engineConfidence === 'number' ? { confidence: engineConfidence } : {}),
    ...(limitation ? { uncertainty: limitation } : {})
  });
  const customerEvidence = (
    id: string,
    label: string,
    value: string,
    sourcePath: string
  ): PastLifeWebtoonEvidence => ({
    id,
    label,
    value: safeNarrative(value, '고객이 직접 적은 현생의 반복 장면을 확인합니다.'),
    description: '고객이 4단계 입력에서 직접 적은 표현이며, 과거 생애의 사실을 뜻하지 않습니다.',
    source: 'customer-input',
    sourcePath
  });

  const evidence: PastLifeWebtoonEvidence[] = [
    engineFields({
      id: 'day-master',
      label: '일간과 오행',
      value: `${report.dayMaster} · ${report.dayMasterElement}`,
      description: '원국에서 계산된 일간과 일간 오행을 반복 기질의 중심축으로 사용했습니다.',
      source: 'natal-chart',
      sourcePath: 'dayMaster'
    }),
    engineFields({
      id: 'month-pillar',
      label: '월주',
      value: report.pillars.month,
      description: '원국의 월주를 계절감과 생활 환경에 반응하는 방식의 근거로 사용했습니다.',
      source: 'natal-chart',
      sourcePath: 'pillars.month'
    }),
    engineFields({
      id: 'dominant-ten-god',
      label: '우세 십성',
      value: dominantTenGod
        ? `${dominantTenGod.label} ${dominantTenGod.value}`
        : '우세 십성 분포 확인 필요',
      description: '계산된 십성 분포에서 가장 높은 항목을 관계와 책임 반응의 참고축으로 사용했습니다.',
      source: 'ten-god',
      sourcePath: dominantTenGod ? `tenGods.${dominantTenGod.index}` : 'tenGods'
    }),
    engineFields({
      id: 'cautious-elements',
      label: '주의 기운',
      value: report.cautiousElements.join(' · ') || '명시된 주의 기운 없음',
      description: '원국에서 주의가 필요한 것으로 계산된 오행을 과잉 반응 점검에 사용했습니다.',
      source: 'natal-chart',
      sourcePath: 'cautiousElements'
    }),
    engineFields({
      id: 'helpful-elements',
      label: '보완 기운',
      value: report.helpfulElements.join(' · ') || '명시된 보완 기운 없음',
      description: '원국에서 보완에 도움이 되는 것으로 계산된 오행을 오늘의 행동 제안에 사용했습니다.',
      source: 'natal-chart',
      sourcePath: 'helpfulElements'
    }),
    engineFields({
      id: 'current-dayun',
      label: '현재 대운',
      value: report.currentDayun.name,
      description: safeNarrative(
        report.currentDayun.summary,
        '현재 대운은 상징 서사를 오늘의 선택과 연결하는 시기 참고값으로 사용했습니다.'
      ),
      source: 'timing',
      sourcePath: 'currentDayun'
    }),
    customerEvidence(
      'customer-scene',
      '직접 적은 반복 장면',
      profile.repeatedScene,
      'pastLifeProfile.repeatedScene'
    ),
    customerEvidence(
      'customer-emotion',
      '직접 적은 반복 감정',
      profile.frequentEmotion,
      'pastLifeProfile.frequentEmotion'
    ),
    customerEvidence(
      'customer-desire',
      '직접 적은 숨은 바람',
      profile.hiddenDesire,
      'pastLifeProfile.hiddenDesire'
    )
  ];

  return new Map(evidence.map((item) => [item.id, item]));
}

function topicFallback(
  title: string,
  volumeTitle: string,
  profile: PastLifeProfile
) {
  return `${title}은 ${profile.repeatedScene}에서 드러난 선택 습관을 ${volumeTitle}의 상징 장면으로 읽습니다. 실제 과거를 확정하지 않고 지금 확인할 수 있는 행동으로 연결합니다.`;
}

function makeReadingSteps(
  report: SajuReportData,
  profile: PastLifeProfile,
  volumeId: PastLifeVolumeId,
  volumeTitle: string,
  volumeIndex: number,
  limitation: string | null
): readonly PastLifeReadingStep[] {
  const beat = profile.storyBeats[volumeIndex];
  const presentChecks: Record<PastLifeVolumeId, string> = {
    seal: `직접 적은 반복 장면 “${profile.repeatedScene}”에서 내가 먼저 맡는 역할과 미루는 요구를 나눠 확인합니다.`,
    relationship: `관계에서 “${profile.frequentEmotion}”이 올라올 때 상대의 말보다 약속·시간·갈등 뒤 회복 행동을 확인합니다.`,
    karma: `끝내지 못한 약속의 상징을 벌로 보지 않고, 책임의 범위와 대가를 말하지 못한 선택이 반복되는지 확인합니다.`,
    present: safeNarrative(
      profile.presentEcho,
      `현생에서 반복되는 “${profile.repeatedScene}” 장면이 어떤 선택 순서로 생기는지 확인합니다.`
    ),
    release: `직접 적은 바람 “${profile.hiddenDesire}”을 희생 없이 이루려면 오늘 어떤 경계를 먼저 말해야 하는지 확인합니다.`
  };
  const actionFallback = beat?.presentEcho || profile.presentEcho;
  const action = report.actionPlan.dos[volumeIndex % Math.max(report.actionPlan.dos.length, 1)];
  const uncertaintySuffix = limitation ? ` ${limitation}` : '';

  return [
    {
      id: 'symbolic-scene',
      label: '상징장면',
      value: safeNarrative(
        beat?.scene,
        `${volumeTitle}은 사주에 나타난 반복 기질을 한 장면으로 번역한 상징 서사입니다.`
      )
    },
    {
      id: 'repeated-trait',
      label: '반복기질',
      value: safeNarrative(
        `${report.dayMaster} 일간과 ${report.gyeokguk}, 현재 ${report.currentDayun.name} 흐름을 함께 보면 “${profile.repeatedScene}”에 담긴 선택 순서를 반복 기질의 참고점으로 읽을 수 있습니다.${uncertaintySuffix}`,
        '원국과 고객이 직접 적은 장면을 함께 보며 반복되는 선택 순서를 살핍니다.'
      )
    },
    {
      id: 'other-possibility',
      label: '다른가능성',
      value: safeNarrative(
        `이 장면은 실제 과거 사건이나 특정 인물을 지목하지 않습니다. 같은 기질도 환경과 관계에 따라 다른 방식으로 나타날 수 있습니다.${uncertaintySuffix}`,
        '상징 장면은 하나의 해석이며, 같은 기질도 환경과 선택에 따라 다르게 나타날 수 있습니다.'
      )
    },
    {
      id: 'present-check',
      label: '현생확인',
      value: safeNarrative(
        presentChecks[volumeId],
        '현생에서 같은 감정과 선택 순서가 반복되는지 실제 행동으로 확인합니다.'
      )
    },
    {
      id: 'today-action',
      label: '오늘행동',
      value: safeNarrative(
        action,
        actionFallback || '오늘 한 번, 답하기 전에 내가 맡을 범위와 필요한 시간을 먼저 확인합니다.'
      )
    }
  ];
}

export function buildPastLifeWebtoonViewModel(
  report: SajuReportData,
  profile: PastLifeProfile
): PastLifeWebtoonViewModel {
  if (report.serviceId !== PAST_LIFE_PRODUCT_ID) {
    throw new Error(`Past-life webtoon view model cannot render product: ${report.serviceId}`);
  }

  const birthTimeKnown = !isUnknownBirthTime(report);
  const limitation = birthTimeKnown
    ? null
    : '출생시간이 없어 시주를 제외하고 연·월·일주와 현재 흐름에서 확인되는 범위만 상징적으로 읽었습니다.';
  const focusLabel = safeNarrative(profile.customerFocus, '자기이해');
  const focusVolumeId = getPastLifeFocusVolumeId(profile.customerFocus);
  const evidenceCatalog = makeEvidenceCatalog(report, profile, limitation);

  const volumes = PAST_LIFE_WEBTOON_VOLUMES.map((webtoonVolume, volumeIndex) => {
    const volume = PAST_LIFE_REPORT_VOLUMES.find(
      (candidate) => candidate.id === webtoonVolume.id
    );

    if (!volume) {
      throw new Error(`Missing canonical past-life volume: ${webtoonVolume.id}`);
    }

    const section = report.sections.find((candidate) => candidate.id === volume.sectionId);
    const details = section?.details ?? [];
    const topics = volume.topics.map((topic, topicIndex): PastLifeWebtoonTopic => {
      const detail = findTopicDetail(details, topic.number, topicIndex);
      const title = detail ? getTopicTitle(detail.summary, topic.title) : topic.title;

      return {
        number: topic.number,
        title,
        content: safeNarrative(
          detail?.content,
          topicFallback(title, volume.title, profile)
        )
      };
    });
    const topicsByNumber = new Map(topics.map((topic) => [topic.number, topic]));
    const readingSteps = makeReadingSteps(
      report,
      profile,
      volume.id,
      volume.title,
      volumeIndex,
      limitation
    );
    const beat = profile.storyBeats[volumeIndex];
    const panelNarratives = [
      beat?.scene,
      beat?.presentEcho,
      section?.callout?.body || readingSteps[4].value
    ];
    const panelDialogues = [
      beat?.goblinLine,
      '익숙하다는 느낌만으로 운명이라 부르지 마. 지금 반복되는 말과 행동을 함께 확인해.',
      readingSteps[4].value
    ];
    const panels = webtoonVolume.panels.map((panelContract, panelIndex) => ({
      id: panelContract.id,
      order: panelContract.order,
      cropPosition: panelContract.cropPosition,
      label: PANEL_LABELS[panelIndex],
      symbolic: true as const,
      artwork: getPastLifeWebtoonScene(panelContract.sceneKey),
      narration: safeNarrative(
        panelNarratives[panelIndex],
        `${volume.title}의 ${PANEL_LABELS[panelIndex]}을 통해 반복 기질을 상징적으로 살핍니다.`
      ),
      dialogue: {
        speaker: '도깨비 장부지기' as const,
        line: safeNarrative(
          panelDialogues[panelIndex],
          '이 장면을 과거의 사실이 아니라 오늘 바꿀 수 있는 선택의 거울로 봐.'
        ),
        side: panelIndex === 1 ? 'right' as const : 'left' as const
      },
      topics: panelContract.topicNumbers.map((topicNumber) => {
        const topic = topicsByNumber.get(topicNumber);
        if (!topic) {
          throw new Error(
            `Missing topic ${topicNumber} for past-life webtoon volume: ${volume.id}`
          );
        }
        return topic;
      })
    }));
    const evidence = VOLUME_EVIDENCE_IDS[volume.id].map((evidenceId) => {
      const item = evidenceCatalog.get(evidenceId);
      if (!item) {
        throw new Error(`Missing past-life evidence: ${evidenceId}`);
      }
      return item;
    });

    return {
      id: volume.id,
      order: webtoonVolume.order,
      sectionId: volume.sectionId,
      volume: volume.volume,
      title: volume.title,
      line: safeNarrative(volume.line, `${volume.title}의 상징 장면`),
      symbol: volume.symbol,
      isFocused: volume.id === focusVolumeId,
      panels,
      readingSteps,
      evidence
    };
  });

  return {
    title: `${report.customerName}님의 도깨비 전생장부`,
    subtitle: '사주의 반복 기질을 다섯 권의 상징 장면과 오늘의 행동으로 잇는 웹툰형 해석',
    openingLine: safeNarrative(
      profile.openingLine,
      `${report.customerName}님, 검은 장부에 비친 반복 기질부터 함께 살펴볼게요.`
    ),
    notice: PAST_LIFE_NARRATIVE_POLICY.notice,
    disclaimer: safeNarrative(profile.disclaimer, PAST_LIFE_NARRATIVE_POLICY.notice),
    focus: {
      label: focusLabel,
      volumeId: focusVolumeId
    },
    birthTimeKnown,
    limitation,
    volumes
  };
}
