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
}

export interface SeunData {
  year: number;
  ganzhi: string;
  note: string;
}
