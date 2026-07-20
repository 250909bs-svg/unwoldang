export interface GZ {
  tg: number;
  dz: number;
}

export interface Bazi {
  y_gz: GZ;
  m_gz: GZ;
  d_gz: GZ;
  h_gz: GZ | null;
  solar: [number, number, number];
  lunar_in: string | null;
  start_age: number;
  /** Exact traditional 3-days-to-1-year conversion retained for boundaries. */
  start_age_exact?: number;
  /** Physical instant at which the first daeyun begins. */
  dayun_start_iso?: string;
  forward: boolean;
  calculationBasis: {
    ipchun: string;
    isAfterIpchun: boolean;
  };
}

export interface DayunData {
  period: number;
  age: string;
  year: number;
  ganzhi: string;
  tenGod: string;
  luckStrength: number;
  startAgeExact?: number;
  startAgeLabel?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface SeunData {
  year: number;
  ganzhi: string;
  note: string;
}
