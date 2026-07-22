import type { SajuReportData } from '../../lib/saju/report';

export const PAST_LIFE_SHARE_EXCLUDED_FIELDS = [
  'customerName',
  'birthLabel',
  'birthDate',
  'birthTime',
  'email',
  'phone',
  'serialNumber',
  'orderId'
] as const;

export type PastLifeShareCard = {
  id: 'seal-name' | 'past-sentence' | 'current-promise';
  label: string;
  value: string;
  tone: 'cyan' | 'red' | 'gold';
};

export function createPastLifeProductShareData(origin: string) {
  return {
    title: 'MZ 도깨비 전생사주',
    text: '사주에 나타난 반복 기질을 상징 서사와 현생 행동으로 읽어보세요.',
    url: `${origin}/detail/past-life-goblin`
  };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function redactPrivateValue(text: string, value: string | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return text;
  }

  return text.replace(new RegExp(`${escapeRegExp(normalized)}(?:님)?`, 'gu'), '고객');
}

export function sanitizePastLifeShareText(
  value: string | undefined,
  privateValues: readonly (string | undefined)[] = []
) {
  let sanitized = (value || '').replace(/\s+/g, ' ').trim();

  privateValues.forEach((privateValue) => {
    sanitized = redactPrivateValue(sanitized, privateValue);
  });

  return sanitized
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[이메일 제외]')
    .replace(/(?:\+?82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}/gu, '[연락처 제외]')
    .replace(/\b\d{6}[-\s]?[1-4]\d{6}\b/gu, '[식별번호 제외]')
    .replace(/\b(?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2}\b/gu, '[생년월일 제외]')
    .replace(/(?:19|20)\d{2}년\s*\d{1,2}월\s*\d{1,2}일/gu, '[생년월일 제외]')
    .slice(0, 220);
}

export function createPastLifeShareCards(report: SajuReportData): readonly PastLifeShareCard[] {
  const privateValues = [report.customerName, report.birthLabel];
  const sanitize = (value: string | undefined, fallback: string) =>
    sanitizePastLifeShareText(value, privateValues) || fallback;
  const sealName = report.badge.replace(/^(?:전생|상징)\s*봉인명\s*·\s*/, '');
  const repeatedPattern = report.keyTakeaways.find((item) => item.title === '반복되는 업')?.body;
  const presentPromise = report.actionPlan.priorities[1] || report.actionPlan.priorities[0];

  return [
    {
      id: 'seal-name',
      label: '나의 상징 봉인명',
      value: sanitize(sealName, '나만의 상징 봉인명'),
      tone: 'cyan'
    },
    {
      id: 'past-sentence',
      label: '사주에 반복된 한 문장',
      value: sanitize(repeatedPattern, '익숙한 선택을 알아차릴 때 새로운 선택이 시작됩니다.'),
      tone: 'red'
    },
    {
      id: 'current-promise',
      label: '이번 생에서 끝낼 약속',
      value: sanitize(presentPromise, '내 책임의 범위와 끝나는 날을 먼저 말합니다.'),
      tone: 'gold'
    }
  ];
}
