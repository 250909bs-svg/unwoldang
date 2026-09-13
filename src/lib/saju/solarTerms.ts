import { SearchSunLongitude } from 'astronomy-engine';

export const SOLAR_TERM_ENGINE_VERSION = 'astronomy-engine-2.1.19';

export const SOLAR_TERM_LONGITUDES = [
  { name: '춘분', longitude: 0 },
  { name: '청명', longitude: 15 },
  { name: '곡우', longitude: 30 },
  { name: '입하', longitude: 45 },
  { name: '소만', longitude: 60 },
  { name: '망종', longitude: 75 },
  { name: '하지', longitude: 90 },
  { name: '소서', longitude: 105 },
  { name: '대서', longitude: 120 },
  { name: '입추', longitude: 135 },
  { name: '처서', longitude: 150 },
  { name: '백로', longitude: 165 },
  { name: '추분', longitude: 180 },
  { name: '한로', longitude: 195 },
  { name: '상강', longitude: 210 },
  { name: '입동', longitude: 225 },
  { name: '소설', longitude: 240 },
  { name: '대설', longitude: 255 },
  { name: '동지', longitude: 270 },
  { name: '소한', longitude: 285 },
  { name: '대한', longitude: 300 },
  { name: '입춘', longitude: 315 },
  { name: '우수', longitude: 330 },
  { name: '경칩', longitude: 345 },
] as const;

const SUPPORTED_YEAR_MIN = 1900;
const SUPPORTED_YEAR_MAX = 2099;
const TROPICAL_YEAR_DAYS = 365.2422;
const SEARCH_MARGIN_DAYS = 5;
const SEARCH_LIMIT_DAYS = 12;

const assertSupportedInput = (year: number, targetLongitude: number) => {
  if (!Number.isInteger(year) || year < SUPPORTED_YEAR_MIN || year > SUPPORTED_YEAR_MAX) {
    throw new Error(`지원하지 않는 절기 계산 연도입니다: ${year}`);
  }

  if (!Number.isFinite(targetLongitude) || targetLongitude < 0 || targetLongitude >= 360) {
    throw new Error(`유효하지 않은 태양 황경입니다: ${targetLongitude}`);
  }
};

const estimateSearchStartUtc = (year: number, targetLongitude: number) => {
  // 춘분(0°) 부근을 기준으로 황경을 연속 축에 놓아 해당 Gregorian year의
  // 절기만 탐색한다. 이 값은 탐색창을 정할 뿐 결과 instant를 보정하지 않는다.
  const continuousLongitude = targetLongitude >= 280 ? targetLongitude - 360 : targetLongitude;
  const estimatedOffsetMs = (continuousLongitude / 360) * TROPICAL_YEAR_DAYS * 86_400_000;
  const marchEquinoxEstimateMs = Date.UTC(year, 2, 20, 12);

  return new Date(
    marchEquinoxEstimateMs + estimatedOffsetMs - SEARCH_MARGIN_DAYS * 86_400_000,
  );
};

/**
 * Finds the absolute UTC instant at which the apparent geocentric Sun reaches
 * the requested ecliptic longitude. Callers may format the returned Date in a
 * requested timezone, but must not reinterpret its UTC fields as local time.
 */
export const getSolarTermInstantForGregorianYear = (
  year: number,
  targetLongitude: number,
): Date => {
  assertSupportedInput(year, targetLongitude);

  let result: ReturnType<typeof SearchSunLongitude>;
  try {
    result = SearchSunLongitude(
      targetLongitude,
      estimateSearchStartUtc(year, targetLongitude),
      SEARCH_LIMIT_DAYS,
    );
  } catch {
    throw new Error(
      `정밀 태양 절기 계산에 실패했습니다: year=${year}, longitude=${targetLongitude}`,
    );
  }

  if (!result || Number.isNaN(result.date.getTime())) {
    throw new Error(
      `정밀 태양 절기 시각을 찾지 못했습니다: year=${year}, longitude=${targetLongitude}`,
    );
  }

  return new Date(result.date.getTime());
};
