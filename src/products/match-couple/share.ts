import type { MatchCoupleReportModel } from './types';

const tendencyLabels = {
  supportive: '서로 살릴 근거가 비교적 선명한 관계',
  conditional: '보완과 조정 조건이 함께 있는 관계',
  tension: '명확한 운영 규칙이 특히 필요한 관계',
  insufficient: '현재 입력만으로 결론을 유보한 관계'
} as const;

export function createMatchCoupleShareData(model: MatchCoupleReportModel, origin: string) {
  const tendency = model.overview?.tendency || 'insufficient';
  return {
    title: '월연도령 사주궁합',
    text: `점수 대신 두 사람의 관계 근거를 비교했어요: ${tendencyLabels[tendency]}`,
    url: `${origin.replace(/\/$/, '')}/detail/match-couple`
  };
}
