import type { IntakeFormData } from '../../api/mockData';
import { calcBazi, tenGod, tenGodFromBranch } from '../../lib/saju/baziCalcs';
import { DZ, TEN_GOD_MEANINGS, TG, type TenGodLabel } from '../../lib/saju/constants';
import {
  createBaziParticipants,
  createGzParticipants,
  detectRelations
} from '../../lib/saju/v2/interactions/relations';
import type { RelationEvidence } from '../../lib/saju/v2/interactions/types';
import type { Bazi } from '../../lib/saju/types';
import {
  withConjunctionParticle,
  withObjectParticle,
  withSubjectParticle
} from '../../lib/korean/particles';

/**
 * 오늘의 운세.
 *
 * 서버도 모델도 부르지 않는다. 오늘의 일진은 날짜에서 결정되고, 그것이 내 원국과 어떤
 * 관계를 맺는지도 이미 있는 엔진이 계산한다(`detectRelations`). 그래서 이 모듈이 하는
 * 일은 **엔진이 낸 값을 하루치로 묶어 읽기 좋게 정리하는 것뿐**이다.
 *
 * 규칙 두 가지.
 *
 * 1) **점수를 지어내지 않는다.** "오늘의 운세 87점" 같은 값은 근거가 없다. 대신 실제로
 *    검출된 관계의 성격(통합/마찰)을 세어 세 단계로만 말한다. 귀연도 순위와 같은 원칙이다.
 * 2) **매일 같은 답이 나온다.** 같은 사람 + 같은 날짜면 언제 열어도 같은 글이다. 난수도
 *    시각 의존도 없다. 하루에 두 번 열었을 때 운세가 바뀌면 그건 운세가 아니다.
 */

export type DailyFortuneTone = 'supportive' | 'steady' | 'caution';

export type DailyFortuneAreaId = 'work' | 'money' | 'relationship' | 'self';

export type DailyFortuneArea = {
  id: DailyFortuneAreaId;
  label: string;
  /** 이 영역이 오늘 활성화됐는지. 활성화된 영역만 화면 위로 올린다. */
  active: boolean;
  statement: string;
};

export type DailyFortuneRelation = {
  name: string;
  /** '인해합' 같은 구체 이름. 규칙에 없으면 비어 있다. */
  subtype?: string;
  polarity: RelationEvidence['polarity'];
  /** 손님에게 읽히는 문장. 엔진의 `description` 은 참가자 id 가 박혀 있어 쓰지 않는다. */
  sentence: string;
};

export type DailyFortune = {
  /** KST 기준 날짜 키. 캐시와 "오늘 것인가" 판단에 쓴다. */
  dateKey: string;
  dayPillar: { stem: string; branch: string; label: string };
  tenGod: { stem: TenGodLabel; branch: TenGodLabel };
  tone: DailyFortuneTone;
  headline: string;
  summary: string;
  areas: DailyFortuneArea[];
  relations: DailyFortuneRelation[];
  /** 검출된 관계 수. 화면에 근거로 함께 보인다. */
  tally: { integrative: number; friction: number };
  uncertainty: string[];
};

/** 십신이 가리키는 삶의 영역. 명리의 통상 대응이고 여기서 새로 만든 분류가 아니다. */
const TEN_GOD_AREA: Record<TenGodLabel, DailyFortuneAreaId> = {
  비견: 'self',
  겁재: 'relationship',
  식신: 'self',
  상관: 'self',
  편재: 'money',
  정재: 'money',
  편관: 'work',
  정관: 'work',
  편인: 'self',
  정인: 'work'
};

const AREA_LABELS: Record<DailyFortuneAreaId, string> = {
  work: '일과 역할',
  money: '돈의 흐름',
  relationship: '사람 사이',
  self: '나의 상태'
};

const TONE_HEADLINES: Record<DailyFortuneTone, string> = {
  supportive: '맞물려 도는 날',
  steady: '조용히 흐르는 날',
  caution: '한 박자 늦추는 날'
};

const FRICTION_POLARITIES = new Set<RelationEvidence['polarity']>(['friction', 'latent-friction']);
const INTEGRATIVE_POLARITIES = new Set<RelationEvidence['polarity']>([
  'integrative',
  'transformative'
]);

/** KST 로 오늘 날짜. 서버 시간대나 사용자의 로컬 시간대에 끌려다니지 않게 고정한다. */
export function koreanDateKey(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  return [
    kst.getUTCFullYear(),
    String(kst.getUTCMonth() + 1).padStart(2, '0'),
    String(kst.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function natalFromForm(formData: Partial<IntakeFormData>): Bazi | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((formData.birthDate || '').trim());
  if (!match) return null;

  const unknownTime = Boolean(formData.isUnknownTime) || formData.birthTimePrecision === 'unknown';
  const time = /^(\d{2}):(\d{2})$/.exec((formData.birthTime || '').trim());
  const usable = !unknownTime && time && Number(time[1]) < 24 && Number(time[2]) < 60 ? time : null;

  return calcBazi(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    usable ? Number(usable[1]) : null,
    usable ? Number(usable[2]) : null,
    formData.calendar === 'lunar' ? 'lunar' : 'solar',
    formData.isLeapMonth ? 'leap' : 'normal',
    formData.gender === 'male' ? 'male' : 'female',
    false
  );
}

function statementFor(label: TenGodLabel, tone: DailyFortuneTone) {
  const themes = withSubjectParticle(TEN_GOD_MEANINGS[label]);

  if (tone === 'caution') {
    return `${themes} 오늘 강하게 건드려집니다. 밀어붙이기보다 한 번 확인하고 가시는 편이 낫습니다.`;
  }
  if (tone === 'supportive') {
    return `${themes} 오늘 자연스럽게 살아납니다. 미뤄 둔 일을 꺼내기 좋습니다.`;
  }
  return `${themes} 오늘의 바탕입니다. 크게 흔들리는 신호는 없습니다.`;
}

/** 상단 요약. 오늘이 어떤 날인지 근거와 함께 한 문단으로 말한다. */
function summaryFor(
  pillar: string,
  stemGod: TenGodLabel,
  branchGod: TenGodLabel,
  tone: DailyFortuneTone,
  tally: { integrative: number; friction: number }
) {
  const gods = stemGod === branchGod ? stemGod : `${stemGod}과 ${branchGod}`;
  const opening = `오늘은 ${pillar}일입니다. 내 일간에서 보면 ${gods}의 자리예요.`;

  if (tally.integrative === 0 && tally.friction === 0) {
    return `${opening} 원국과 맞물리는 합·충은 잡히지 않아, 오늘은 평소의 결로 흘러갑니다.`;
  }
  if (tone === 'caution') {
    return `${opening} 원국과 부딪히는 신호가 ${tally.friction}개로 더 많아, 서두르면 걸리는 자리가 생깁니다.`;
  }
  if (tone === 'supportive') {
    return `${opening} 원국과 맞물리는 신호가 ${tally.integrative}개로 더 많아, 먼저 움직여도 받쳐 주는 날입니다.`;
  }
  return `${opening} 맞물리는 신호와 부딪히는 신호가 같아, 한쪽으로 기울지 않는 날입니다.`;
}

/* 기둥 이름은 천간이냐 지지냐에 따라 다르다 — 월주는 간지 한 쌍이고, 여기서 만나는
   것은 그 중 한 글자다. 지지면 '월지', 천간이면 '월간' 이라고 불러야 맞다. */
const PILLAR_NAMES: Record<string, string> = {
  year: '연',
  month: '월',
  day: '일',
  hour: '시',
  luck: '오늘'
};

function positionLabel(position: string, component: 'stem' | 'branch') {
  const pillar = PILLAR_NAMES[position];
  if (!pillar || position === 'luck') return pillar || '';

  return `${pillar}${component === 'branch' ? '지' : '간'}`;
}

/**
 * 손님이 읽을 한 줄로 관계를 옮긴다.
 *
 * 엔진의 `description` 은 `ilun luckbranch 해 · natal monthbranch 인 …` 처럼 참가자 id 를
 * 그대로 담는다. 내부 추적용으로는 맞지만 손님 화면에 그대로 내보낼 글이 아니다.
 */
function describeForReader(relation: RelationEvidence) {
  const today = relation.participants.find((participant) => participant.layer === 'ilun');
  const mine = relation.participants.filter((participant) => participant.layer === 'natal');
  const name = relation.subtype || relation.name;

  if (!today || mine.length === 0) return `${name} 관계가 성립합니다.`;

  const mineText = mine
    .map(
      (participant) =>
        `${positionLabel(participant.position, participant.component)} ${participant.label}`.trim()
    )
    .join(' · ');

  return `오늘의 ${withSubjectParticle(today.label)} 내 ${withConjunctionParticle(mineText)} 만나 ${withObjectParticle(name)} 이룹니다.`;
}

/**
 * 오늘의 운세를 만든다. 출생정보가 없거나 형식이 깨지면 null.
 *
 * `dateKey` 를 넘기면 그 날짜로 계산한다 — 테스트와 "내일 보기" 가 같은 경로를 쓴다.
 */
export function buildDailyFortune(
  formData?: Partial<IntakeFormData> | null,
  dateKey = koreanDateKey()
): DailyFortune | null {
  if (!formData) return null;

  const date = parseDateKey(dateKey);
  if (!date) return null;

  const natal = natalFromForm(formData);
  if (!natal) return null;

  /* 오늘의 일진. 시간은 넣지 않는다 — 하루의 기둥을 보는 것이지 특정 시각이 아니다. */
  const today = calcBazi(date.year, date.month, date.day, null, null, 'solar', 'normal', 'male', false);
  const todayGz = today.d_gz;

  const relations = detectRelations(
    [
      ...createBaziParticipants(natal, 'natal'),
      ...createGzParticipants(todayGz, 'ilun', 'luck')
    ],
    /* 원국 안에서 원래 있던 관계는 오늘의 일이 아니다. 교차만 본다. */
    { scope: 'cross-layer-only' }
  );

  const integrative = relations.filter((relation) => INTEGRATIVE_POLARITIES.has(relation.polarity)).length;
  const friction = relations.filter((relation) => FRICTION_POLARITIES.has(relation.polarity)).length;

  const tone: DailyFortuneTone =
    friction > integrative ? 'caution' : integrative > friction ? 'supportive' : 'steady';

  const stemGod = tenGod(natal.d_gz.tg, todayGz.tg);
  const branchGod = tenGodFromBranch(natal.d_gz.tg, todayGz.dz);
  const activeAreas = new Set<DailyFortuneAreaId>([TEN_GOD_AREA[stemGod], TEN_GOD_AREA[branchGod]]);

  const areas: DailyFortuneArea[] = (Object.keys(AREA_LABELS) as DailyFortuneAreaId[]).map((id) => {
    const active = activeAreas.has(id);
    const driver = TEN_GOD_AREA[stemGod] === id ? stemGod : branchGod;

    return {
      id,
      label: AREA_LABELS[id],
      active,
      statement: active
        ? statementFor(driver, tone)
        : '오늘 특별히 건드려지는 신호는 없습니다. 평소의 흐름으로 보셔도 됩니다.'
    };
  });

  const uncertainty = [
    ...(natal.h_gz
      ? []
      : ['출생시간이 미상이라 시주를 뺀 세 기둥으로만 오늘과 대조했습니다.']),
    ...(relations.length === 0
      ? ['오늘의 일진과 원국 사이에 뚜렷한 합·충이 검출되지 않았습니다.']
      : [])
  ];

  return {
    dateKey,
    dayPillar: {
      stem: TG[todayGz.tg],
      branch: DZ[todayGz.dz],
      label: `${TG[todayGz.tg]}${DZ[todayGz.dz]}`
    },
    tenGod: { stem: stemGod, branch: branchGod },
    tone,
    headline: TONE_HEADLINES[tone],
    /* 요약은 영역 문장과 달라야 한다. 같은 글이 두 번 나오면 읽는 사람이 한 번은 헛읽는다.
       여기서는 오늘의 기둥과 두 십신이 무엇인지 말하고, 자세한 결은 영역 카드가 맡는다. */
    summary: summaryFor(
      `${TG[todayGz.tg]}${DZ[todayGz.dz]}`,
      stemGod,
      branchGod,
      tone,
      { integrative, friction }
    ),
    areas: [...areas].sort((left, right) => Number(right.active) - Number(left.active)),
    relations: relations.map((relation) => ({
      name: relation.name,
      subtype: relation.subtype,
      polarity: relation.polarity,
      sentence: describeForReader(relation)
    })),
    tally: { integrative, friction },
    uncertainty
  };
}
