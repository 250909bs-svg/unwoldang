import type { IntakeFormData } from '../../api/mockData';
import {
  calcBazi,
  describeDayMaster,
  daymasterStrength,
  getPillarLabels,
  getZodiacAnimal
} from '../../lib/saju/baziCalcs';
import { DZ, TG } from '../../lib/saju/constants';
import { GENERAL_SIGNATURE_DRAFT_KEY } from '../../products/general-signature/generalSignatureIntakeContract';
import { readReportArchiveEntries } from '../../lib/reportArchive';

/**
 * 내 만세력.
 *
 * 서버를 부르지 않는다. 사주 원국은 출생정보만 있으면 결정되고 그 계산은 이미 클라이언트에
 * 있다(`baziCalcs`). 그래서 이 화면은 이미 저장된 출생정보를 다시 읽어 네 기둥을 세우는
 * 일만 한다 — 새로 받는 정보도, 새로 보내는 정보도 없다.
 *
 * 출생정보의 출처는 두 곳이고, 최근 것이 먼저다.
 *   1) 보관함에 있는 종합사주 리포트의 입력값
 *   2) 이 브라우저에 남은 입력 초안
 * 둘 다 없으면 만세력을 세울 근거가 없으므로 화면은 첫 리포트로 안내한다.
 */

export type ManseryeokPillar = {
  /** 연·월·일·시 */
  position: 'year' | 'month' | 'day' | 'hour';
  label: string;
  /** 천간 한 글자. */
  stem: string;
  /** 지지 한 글자. */
  branch: string;
};

export type ManseryeokChart = {
  name: string;
  /** 시주가 없으면 세 기둥만 세운다. 시간 미상을 자시로 가정하지 않는다. */
  pillars: ManseryeokPillar[];
  hourKnown: boolean;
  zodiac: string;
  dayMaster: {
    stem: string;
    keywords: string[];
    description: string;
  };
  strength: {
    label: string;
    /** 일간을 돕는 쪽의 비중(0~1). 게이지 하나를 채우는 값이다. */
    ratio: number;
  };
  /** 양력 환산 날짜와 입춘 기준. 만세력을 검산할 때 필요한 값이다. */
  basis: {
    solarDate: string;
    lunarInput: string | null;
    afterIpchun: boolean;
  };
};

export type ManseryeokSource = 'archive' | 'recent-input';

const POSITION_LABELS: Record<ManseryeokPillar['position'], string> = {
  year: '연주',
  month: '월주',
  day: '일주',
  hour: '시주'
};

function parseBirthDate(value?: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return { year, month, day };
}

function parseBirthTime(formData: Partial<IntakeFormData>) {
  if (formData.isUnknownTime || formData.birthTimePrecision === 'unknown') return null;

  const match = /^(\d{2}):(\d{2})$/.exec((formData.birthTime || '').trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;

  return { hour, minute };
}

/** 저장된 출생정보 한 건으로 원국을 세운다. 세울 수 없으면 null. */
export function buildManseryeokChart(formData?: Partial<IntakeFormData> | null): ManseryeokChart | null {
  if (!formData) return null;

  const date = parseBirthDate(formData.birthDate);
  if (!date) return null;

  const time = parseBirthTime(formData);
  const bazi = calcBazi(
    date.year,
    date.month,
    date.day,
    time ? time.hour : null,
    time ? time.minute : null,
    formData.calendar === 'lunar' ? 'lunar' : 'solar',
    formData.isLeapMonth ? 'leap' : 'normal',
    formData.gender === 'male' ? 'male' : 'female',
    false
  );

  const labels = getPillarLabels(bazi);
  const gz = { year: bazi.y_gz, month: bazi.m_gz, day: bazi.d_gz, hour: bazi.h_gz };

  const pillars = (['year', 'month', 'day', 'hour'] as const)
    .filter((position) => labels[position] !== null)
    .map((position) => {
      const pillar = gz[position];

      return {
        position,
        label: POSITION_LABELS[position],
        stem: pillar ? TG[pillar.tg] : '',
        branch: pillar ? DZ[pillar.dz] : ''
      };
    });

  const [allyRatio, strengthLabel] = daymasterStrength(bazi);
  const dayStem = TG[bazi.d_gz.tg];
  const dayMaster = describeDayMaster(dayStem);

  return {
    name: formData.name?.trim().slice(0, 20) || '나',
    pillars,
    hourKnown: Boolean(labels.hour),
    zodiac: getZodiacAnimal(bazi.y_gz),
    dayMaster: {
      stem: dayStem,
      keywords: [...dayMaster.keywords],
      description: dayMaster.description
    },
    strength: {
      label: strengthLabel,
      /* daymasterStrength 의 첫 값은 이미 0~1 비율이다. 게이지를 넘거나 음수로
         내려가면 CSS 폭 계산이 깨지므로 가장자리를 잘라 둔다. */
      ratio: Math.min(1, Math.max(0, allyRatio))
    },
    basis: {
      solarDate: `${bazi.solar[0]}.${String(bazi.solar[1]).padStart(2, '0')}.${String(bazi.solar[2]).padStart(2, '0')}`,
      lunarInput: bazi.lunar_in,
      afterIpchun: bazi.calculationBasis.isAfterIpchun
    }
  };
}

/** 가장 최근의 출생정보를 찾는다. 보관함이 먼저, 없으면 입력 초안. */
export function resolveManseryeokSource(ownerId?: string): {
  formData: Partial<IntakeFormData>;
  source: ManseryeokSource;
} | null {
  const archived = readReportArchiveEntries(ownerId)
    .filter((entry) => entry.formData?.birthDate)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];

  if (archived?.formData) return { formData: archived.formData, source: 'archive' };

  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(GENERAL_SIGNATURE_DRAFT_KEY);
    if (!raw) return null;

    const draft = JSON.parse(raw) as Partial<IntakeFormData>;
    return draft?.birthDate ? { formData: draft, source: 'recent-input' } : null;
  } catch {
    return null;
  }
}
