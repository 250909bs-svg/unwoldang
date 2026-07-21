import type {
  ReunionAnswerFirst,
  ReunionContactWindow,
  ReunionMetric,
  ReunionMetricId,
  SafetyGateStatus
} from './types';

export function buildReunionAnswerFirst(
  questionIds: string[],
  metrics: ReunionMetric[],
  windows: ReunionContactWindow[],
  safetyStatus: SafetyGateStatus
): ReunionAnswerFirst[] {
  const map = new Map(metrics.map((metric) => [metric.id, metric]));
  const get = (id: ReunionMetricId) => map.get(id)!;
  const safetyOnly =
    safetyStatus === 'ANALYSIS_BLOCKED' || safetyStatus === 'CONTACT_PROHIBITED';
  if (safetyOnly) {
    const questionTitles: Record<string, string> = {
      'contact-timing': '언제 연락을 검토해야 할까?',
      'contact-first': '내가 먼저 연락해도 될까?',
      'recurrence-risk': '다시 만나면 같은 이유로 끝날까?',
      'long-term-fit': '다시 만나면 오래 갈 수 있을까?',
      'reply-strategy': '답장이 올 흐름과 대응은?',
      'meeting-strategy': '다시 만나는 장면까지 이어질까?',
      'contact-temperature': '그 사람의 현재 마음은?'
    };
    const analysisBlocked = safetyStatus === 'ANALYSIS_BLOCKED';
    return questionIds.slice(0, 3).map((questionId) => ({
      question: questionTitles[questionId] || '우리의 재회 흐름은?',
      answer: analysisBlocked
        ? '안전 게이트에 따라 명리·관계 분석을 중단했습니다. 지금은 안전 확보와 전문 지원이 먼저입니다.'
        : '상대가 세운 비접촉 경계를 우선해 연락·재회 결과 분석을 제공하지 않습니다.',
      confidence: 'high',
      evidenceIds: ['safety:gate'],
      counterEvidenceIds: ['system:observable-limit'],
      nextAction: analysisBlocked
        ? '직접 접촉을 멈추고 신뢰할 수 있는 사람이나 지역 전문기관에 도움을 요청하세요.'
        : '차단·거절을 우회하지 말고 비접촉 회복 계획을 따르세요.'
    }));
  }
  const contactGuidanceBlocked = safetyStatus !== 'CONTACT_ELIGIBLE';
  const blocked = contactGuidanceBlocked;

  return questionIds.slice(0, 3).map((questionId) => {
    if (questionId === 'contact-timing') {
      return {
        question: '언제 연락을 검토해야 할까?',
        answer: blocked
          ? '현재는 연락 시기를 제공하지 않습니다. 준비 조건과 회복 행동을 먼저 채워야 합니다.'
          : windows[0]
            ? '첫 검토 구간은 ' + windows[0].range +
              '입니다. 특정 날짜의 결과를 약속하는 뜻은 아닙니다.'
            : '지금은 시기보다 준비 조건을 먼저 충족해야 합니다.',
        confidence: windows.length ? 'medium' : 'limited',
        evidenceIds: windows[0]?.evidenceIds || ['safety:gate'],
        counterEvidenceIds: ['system:observable-limit'],
        nextAction: blocked
          ? '비접촉 상태에서 30일 준비 계획을 먼저 따르세요.'
          : '연락 전 안전 게이트를 다시 확인하세요.'
      };
    }

    if (questionId === 'contact-first') {
      const metric = get('outgoing-suitability');
      return {
        question: '내가 먼저 연락해도 될까?',
        answer: metric.score === null
          ? '아니요. 현재 경계·안전 조건에서는 먼저 연락하지 않아야 합니다.'
          : metric.summary + ' 현재 지수는 ' + metric.score + '/100입니다.',
        confidence: metric.score === null ? 'high' : 'medium',
        evidenceIds: metric.evidenceIds,
        counterEvidenceIds: metric.counterEvidenceIds,
        nextAction: metric.actions[0]
      };
    }

    if (questionId === 'recurrence-risk') {
      const metric = get('recurrence-risk');
      return {
        question: '다시 만나면 같은 이유로 끝날까?',
        answer: metric.summary + ' 재발 위험 지수는 ' +
          (metric.score ?? '보류') + '/100입니다.',
        confidence: 'medium',
        evidenceIds: metric.evidenceIds,
        counterEvidenceIds: metric.counterEvidenceIds,
        nextAction: '재회 의사보다 바뀐 행동을 30일간 먼저 확인하세요.'
      };
    }

    if (questionId === 'long-term-fit') {
      const metric = get('long-term');
      return {
        question: '다시 만나면 오래 갈 수 있을까?',
        answer: metric.score === null
          ? metric.summary
          : metric.summary + ' 장기 지속 지수는 ' + metric.score + '/100입니다.',
        confidence: 'limited',
        evidenceIds: metric.evidenceIds,
        counterEvidenceIds: metric.counterEvidenceIds,
        nextAction: contactGuidanceBlocked
          ? '현실 장벽 중 내가 바꿀 수 있는 한 가지를 30일 행동으로 기록하세요.'
          : '거리·신뢰·가족·돈 중 가장 큰 장벽 하나를 합의 문장으로 바꾸세요.'
      };
    }

    if (questionId === 'reply-strategy') {
      const metric = get('reply');
      return {
        question: '답장이 올 흐름과 대응은?',
        answer: metric.score === null
          ? metric.summary
          : metric.summary + ' 답장 전환 지수는 ' + metric.score + '/100입니다.',
        confidence: 'limited',
        evidenceIds: metric.evidenceIds,
        counterEvidenceIds: metric.counterEvidenceIds,
        nextAction: contactGuidanceBlocked
          ? '메시지를 보내지 말고 무응답을 받아들이는 연습과 일상 회복을 우선하세요.'
          : '보낸 뒤 7일 동안 추가 연락 없이 실제 행동을 기다리세요.'
      };
    }

    if (questionId === 'meeting-strategy') {
      const metric = get('meeting');
      return {
        question: '다시 만나는 장면까지 이어질까?',
        answer: metric.score === null
          ? metric.summary
          : metric.summary + ' 만남 전환 지수는 ' + metric.score + '/100입니다.',
        confidence: 'limited',
        evidenceIds: metric.evidenceIds,
        counterEvidenceIds: metric.counterEvidenceIds,
        nextAction: contactGuidanceBlocked
          ? '만남을 계획하지 말고 준비도와 경계 존중 행동을 먼저 기록하세요.'
          : '상대가 대화를 자발적으로 이어갈 때만 짧은 만남을 검토하세요.'
      };
    }

    if (questionId === 'contact-temperature') {
      const metric = get('emotional-residue');
      return {
        question: '그 사람의 현재 마음은?',
        answer: '속마음은 단정할 수 없습니다. 대신 관계 기간과 최근 연락 행동으로 본 ' +
          metric.label + '는 ' + (metric.score ?? '보류') + '/100입니다.',
        confidence: 'limited',
        evidenceIds: metric.evidenceIds,
        counterEvidenceIds: metric.counterEvidenceIds,
        nextAction: '추측보다 상대가 직접 말하고 반복해서 보이는 행동만 기록하세요.'
      };
    }

    const metric = get('reunion');
    return {
      question: '우리의 재회 흐름은?',
      answer: metric.score === null
        ? metric.summary
        : metric.summary + ' 재회 지수는 ' + metric.score +
          '/100이며 실제 성사율을 뜻하지 않습니다.',
      confidence: 'limited',
      evidenceIds: metric.evidenceIds,
      counterEvidenceIds: metric.counterEvidenceIds,
      nextAction: safetyStatus === 'CONTACT_ELIGIBLE'
        ? '세 선택 비교에서 멈춤 조건까지 확인한 뒤 결정하세요.'
        : '안전 게이트의 우선 행동부터 따르세요.'
    };
  });
}
