import { loveFocusValues, type LoveFocus } from '../api/mockData';

const loveFocusSet = new Set<string>(loveFocusValues);

export const LOVE_FOCUS_LABELS: Record<LoveFocus, string> = {
  'partner-type': '내게 맞는 사람의 특징',
  'next-love-timing': '다음 연애를 하는 시기',
  'my-attraction': '이성들이 보는 내 진짜 매력',
  'repeated-pattern': '내가 반복하는 사랑의 패턴'
};

export function normalizeLoveFocus(value: unknown): LoveFocus | null {
  return typeof value === 'string' && loveFocusSet.has(value)
    ? (value as LoveFocus)
    : null;
}

export function getLoveFocusLabel(value: unknown) {
  const focus = normalizeLoveFocus(value);
  return focus ? LOVE_FOCUS_LABELS[focus] : '';
}
