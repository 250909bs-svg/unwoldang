export interface RewardWallet {
  luckTickets: number;
  stars: number;
  coupons: number;
  invitePoints: number;
  lastTarotMissionDate: string | null;
  updatedAt: string;
}

export interface RewardMutationResult {
  ok: boolean;
  wallet: RewardWallet;
  message: string;
}

const REWARD_STORAGE_KEY = 'unwoldang.reward.wallet';

const defaultWallet: RewardWallet = {
  luckTickets: 3,
  stars: 25,
  coupons: 2,
  invitePoints: 50,
  lastTarotMissionDate: null,
  updatedAt: new Date().toISOString()
};

function toNonNegativeInt(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function sanitizeWallet(payload?: Partial<RewardWallet> | null): RewardWallet {
  return {
    luckTickets: toNonNegativeInt(payload?.luckTickets, defaultWallet.luckTickets),
    stars: toNonNegativeInt(payload?.stars, defaultWallet.stars),
    coupons: toNonNegativeInt(payload?.coupons, defaultWallet.coupons),
    invitePoints: toNonNegativeInt(payload?.invitePoints, defaultWallet.invitePoints),
    lastTarotMissionDate:
      typeof payload?.lastTarotMissionDate === 'string' && payload.lastTarotMissionDate
        ? payload.lastTarotMissionDate
        : null,
    updatedAt:
      typeof payload?.updatedAt === 'string' && payload.updatedAt
        ? payload.updatedAt
        : new Date().toISOString()
  };
}

function writeWallet(wallet: RewardWallet) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(REWARD_STORAGE_KEY, JSON.stringify(wallet));
}

function mutateWallet(mutator: (wallet: RewardWallet) => RewardWallet) {
  const nextWallet = mutator(readRewardWallet());
  writeWallet(nextWallet);
  return nextWallet;
}

export function getRewardDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function readRewardWallet(): RewardWallet {
  if (typeof window === 'undefined') {
    return defaultWallet;
  }

  const raw = window.localStorage.getItem(REWARD_STORAGE_KEY);

  if (!raw) {
    return defaultWallet;
  }

  try {
    return sanitizeWallet(JSON.parse(raw) as Partial<RewardWallet>);
  } catch {
    window.localStorage.removeItem(REWARD_STORAGE_KEY);
    return defaultWallet;
  }
}

export function spendLuckTickets(amount = 1): RewardMutationResult {
  const current = readRewardWallet();

  if (current.luckTickets < amount) {
    return {
      ok: false,
      wallet: current,
      message: `행운권이 부족합니다. 현재 ${current.luckTickets}장 보유 중입니다.`
    };
  }

  const wallet = mutateWallet((prev) => ({
    ...prev,
    luckTickets: Math.max(0, prev.luckTickets - amount),
    updatedAt: new Date().toISOString()
  }));

  return {
    ok: true,
    wallet,
    message: `행운권 ${amount}장을 사용했습니다.`
  };
}

export function spendStars(amount = 1): RewardMutationResult {
  const current = readRewardWallet();

  if (current.stars < amount) {
    return {
      ok: false,
      wallet: current,
      message: `별이 부족합니다. 현재 ${current.stars}개 보유 중입니다.`
    };
  }

  const wallet = mutateWallet((prev) => ({
    ...prev,
    stars: Math.max(0, prev.stars - amount),
    updatedAt: new Date().toISOString()
  }));

  return {
    ok: true,
    wallet,
    message: `별 ${amount}개를 사용했습니다.`
  };
}

export function claimDailyTarotMission(reward = 70): RewardMutationResult {
  const current = readRewardWallet();
  const todayKey = getRewardDateKey();

  if (current.lastTarotMissionDate === todayKey) {
    return {
      ok: false,
      wallet: current,
      message: '오늘의 타로 미션은 이미 완료했습니다. 내일 다시 참여할 수 있어요.'
    };
  }

  const wallet = mutateWallet((prev) => ({
    ...prev,
    stars: prev.stars + Math.max(0, reward),
    lastTarotMissionDate: todayKey,
    updatedAt: new Date().toISOString()
  }));

  return {
    ok: true,
    wallet,
    message: `오늘의 미션 완료! 별 ${reward}개가 적립되었습니다.`
  };
}
