/**
 * 재회운 리포트 · 밴드 조정 테이블 (명세 §2-3).
 *
 * 원칙: 한 목차, 한 리포트, 한 화자. 연령별 페이지를 만들지 않는다.
 * 장 구성과 장 순서는 전 밴드 동일하고, 밴드가 바꾸는 것은
 * 어휘 / 확장 블록 / 기본 펼침 장 / 추가 금지어 네 가지뿐이다.
 * **나이·세대를 화면 문장에 단 한 번도 쓰지 않는다.**
 *
 * 코드 분기가 아니라 프리즈드 맵이다. `if (band === 'thirties')` 를 쓰지 말고
 * 이 표에서 값을 꺼내 쓴다.
 */

import type { ReunionAgeBand } from './ageBand';
import { REUNION_AGE_BANDS } from './ageBand';
import type { ReunionChapterIndex } from './reportTypes';

export interface ReunionBandLexicon {
  /** 연락 채널 일반어 */
  channel: string;
  /** 답이 없는 상태를 부르는 말 */
  silence: string;
  /** 상대 호칭 — 전 밴드 '그 사람' 고정 */
  partner: string;
  /** 시간 간격 단위 표현 */
  interval: string;
}

export interface ReunionBandExpansion {
  chapter: ReunionChapterIndex;
  blockId: string;
}

export interface ReunionBandProfile {
  /** 문장 슬롯에 갈아 끼우는 어휘. 키는 고정, 값만 밴드별로 다름. */
  lexicon: ReunionBandLexicon;
  /** 해당 밴드에서만 렌더되는 블록 id. 없으면 빈 배열. */
  expansions: readonly ReunionBandExpansion[];
  /** 첫 스크롤에서 펼쳐진 상태로 여는 장 (정확히 2). 나머지는 접힌 카드로 '존재'하되 숨기지 않는다. */
  expandedChapters: readonly [ReunionChapterIndex, ReunionChapterIndex];
  /** 이 밴드에서 추가로 금지되는 표현. 공통 금지어와 합집합으로 검사한다. */
  banned: readonly string[];
  /** 근거 확보 여부. 'hypothesis' 밴드에는 전용 제작비를 태우지 않는다. */
  evidence: 'observed' | 'hypothesis';
}

/** 전 밴드 공통 상대 호칭. `남친/여친/전남친/전여친` 은 전 밴드 금지다. */
export const REUNION_PARTNER_TERM = '그 사람' as const;

export const REUNION_BAND_COPY: Readonly<Record<ReunionAgeBand, ReunionBandProfile>> = Object.freeze({
  teen: {
    lexicon: { channel: '메시지', silence: '답이 오지 않는 상태', partner: REUNION_PARTNER_TERM, interval: '며칠' },
    /* 'discreet-exit'(들키지 않는 접근) 블록은 §6-B 로 삭제됐다. 되살리지 말 것. */
    expansions: [],
    expandedChapters: [3, 2],
    banned: ['아직 어리니까', '공부에 집중', '인생 길다', '나중에 보면', '그 나이엔'],
    evidence: 'hypothesis'
  },
  early20s: {
    lexicon: { channel: '메시지', silence: '읽고 답이 없는 상태', partner: REUNION_PARTNER_TERM, interval: '몇 주' },
    expansions: [{ chapter: 1, blockId: 'achievement-urge' }],
    expandedChapters: [3, 2],
    banned: ['아직 어리니까', '인생 길다', '더 좋은 사람'],
    evidence: 'observed'
  },
  late20s: {
    lexicon: { channel: '메시지', silence: '읽고 답이 없는 상태', partner: REUNION_PARTNER_TERM, interval: '몇 주' },
    expansions: [
      { chapter: 1, blockId: 'pride-motive' },
      { chapter: 3, blockId: 'after-settling' }
    ],
    expandedChapters: [1, 3],
    banned: ['더 좋은 사람', '인연은 또 온다'],
    evidence: 'observed'
  },
  thirties: {
    lexicon: { channel: '연락', silence: '답이 없는 상태', partner: REUNION_PARTNER_TERM, interval: '몇 달' },
    expansions: [
      { chapter: 4, blockId: 'deadline-cost' },
      { chapter: 6, blockId: 'letting-go-years' }
    ],
    expandedChapters: [4, 5],
    banned: ['아직 젊다', '늦지 않았다', '인연은 또 온다', '더 좋은 사람', '나이가'],
    evidence: 'observed'
  },
  forties: {
    lexicon: { channel: '연락', silence: '답이 없는 상태', partner: REUNION_PARTNER_TERM, interval: '몇 달' },
    expansions: [
      { chapter: 0, blockId: 'affected-people' },
      { chapter: 5, blockId: 'not-only-for-them' }
    ],
    expandedChapters: [5, 4],
    banned: ['전남친', '전여친', '남친', '여친', '아직 젊다', '더 좋은 사람'],
    evidence: 'observed'
  },
  fiftyPlus: {
    lexicon: { channel: '연락', silence: '답이 없는 상태', partner: REUNION_PARTNER_TERM, interval: '몇 달' },
    expansions: [
      { chapter: 0, blockId: 'affected-people' },
      { chapter: 5, blockId: 'not-only-for-them' }
    ],
    banned: ['전남친', '전여친', '남친', '여친', '아직 젊다', '더 좋은 사람'],
    expandedChapters: [5, 4],
    /* 50~60대 직접 발화 미확보 — 가설. 전용 톤·페이지를 만들지 않는다. */
    evidence: 'hypothesis'
  },
  neutral: {
    lexicon: { channel: '연락', silence: '답이 없는 상태', partner: REUNION_PARTNER_TERM, interval: '얼마간' },
    expansions: [],
    expandedChapters: [3, 2],
    banned: [],
    evidence: 'observed'
  }
});

export function getReunionBandProfile(band: ReunionAgeBand): ReunionBandProfile {
  return REUNION_BAND_COPY[band] || REUNION_BAND_COPY.neutral;
}

/** 이 밴드에서 해당 장에 붙는 확장 블록 id 목록. */
export function getBandExpansionBlocks(band: ReunionAgeBand, chapter: ReunionChapterIndex): readonly string[] {
  return getReunionBandProfile(band)
    .expansions.filter((item) => item.chapter === chapter)
    .map((item) => item.blockId);
}

export function isChapterExpandedByDefault(band: ReunionAgeBand, chapter: ReunionChapterIndex): boolean {
  return getReunionBandProfile(band).expandedChapters.includes(chapter);
}

/**
 * 문장 슬롯 치환. `{channel}` `{silence}` `{partner}` `{interval}` `{name}` 만 인식한다.
 * 알 수 없는 슬롯은 그대로 남겨 테스트가 잡을 수 있게 한다.
 */
export function applyBandLexicon(template: string, band: ReunionAgeBand, name: string): string {
  const { lexicon } = getReunionBandProfile(band);
  return template
    .replace(/\{channel\}/gu, lexicon.channel)
    .replace(/\{silence\}/gu, lexicon.silence)
    .replace(/\{partner\}/gu, lexicon.partner)
    .replace(/\{interval\}/gu, lexicon.interval)
    .replace(/\{name\}/gu, name);
}

export const REUNION_HYPOTHESIS_BANDS: readonly ReunionAgeBand[] = REUNION_AGE_BANDS.filter(
  (band) => REUNION_BAND_COPY[band].evidence === 'hypothesis'
);
