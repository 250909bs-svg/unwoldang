/**
 * 재회운 리포트 화면 (명세 §1, §3, §5, §6).
 *
 * 8유닛(프롤로그 + 6장 + 편지)을 컷 단위로 세운다. 판정·집계·날짜·차트는
 * `src/lib/reunion` 이 결정론으로 만들고, 이 파일은 그 결과를 그린다.
 * 화면에서 문장을 만들거나 숫자를 계산하지 않는다.
 *
 * 화자는 **운월**. 존댓말, `{이름}님`. 장 제목은 독자의 1인칭 질문이다.
 * 반말 도발 화법과 화자 캐릭터는 참고 페이지에서 가져오지 않는다.
 *
 * 시각 층은 `reunion-premium.css` 의 `ud-` 토큰·유틸리티와
 * `reunionOrnaments.tsx` 의 장식 SVG, `reunionMeters.tsx` 의 계측 프리미티브가 소유한다.
 * 이 파일은 그것들을 **조립만** 한다 — 색·여백을 여기서 정하지 않는다.
 *
 * 모션은 전부 `ud-` 패턴이다. `useRevealOnScroll` 이 `[data-reveal]` 에 `.is-visible` 을
 * 붙이고, 각 패턴의 **최종 상태가 기본값**이므로 IntersectionObserver 가 실패해도
 * 콘텐츠가 숨겨진 채 남지 않는다. `reunion-report.css` 는 계속 무모션이다.
 *
 * 안전 계약(타협 불가):
 *   - CH00 판단 게이트가 `deferred` 면 나머지 장을 접고 **결제·다음 상품 유도를 렌더하지 않는다**.
 *   - 삭제 불가 문구 7개는 어떤 상태에서도 화면에 남는다.
 *   - 신호 판독표는 이미 일어난 대화의 속성만 다루고 체크를 저장하지 않는다.
 *   - 계산되지 않은 수치를 사실처럼 보여주지 않는다. 최상단 헤드라인의 계측은
 *     `ReunionMeterReading` 유니온을 타므로, 보류·자료 없음에서는 숫자를 그리는 경로가 없다.
 */

import { ArrowRight, Link as LinkIcon, Sparkles } from 'lucide-react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { Link } from 'react-router-dom';
import type { IntakeFormData } from '../../api/mockData';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import {
  REUNION_CONTEXT_VERSION,
  buildReunionReportPayload,
  createEmptyReunionSelfCheck,
  type ReunionContext,
  type ReunionReportPayload,
  type ReunionSelfCheck,
  type ReunionSelfCheckAnswer,
  type ReunionTimelineCell,
  type ReunionTimingLabel
} from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';
import { canDiscoverProduct } from '../../products/registry';
import '../../styles/reunion-premium.css';
import '../../styles/reunion-report.css';
import ReunionCutView, { type ReunionCutInteractions } from './reunionReportCuts';
import {
  ReunionMeterHeadline,
  useReunionCountUp,
  type ReunionMeterReading
} from './reunionMeters';
import {
  UdChapterRule,
  UdCorners,
  UdFretDivider,
  UdMedallion,
  UdOrnamentDefs
} from './reunionOrnaments';
import { buildReunionChapterEvidence, formatReunionDayunLabel } from './reportEvidence';

type ReunionReportViewProps = {
  report: SajuReportData;
  formData: Partial<IntakeFormData>;
  reunionContext?: ReunionContext | null;
};

const DEADLINE_KEY = 'unwoldang.reunion.deadline';
const DECISION_KEY = 'unwoldang.reunion.decision';

/**
 * 인테이크 맥락이 없는 진입(보관함 복원, 로컬 미리보기)에서 쓰는 빈 맥락.
 * 값을 지어내지 않는다 — 전부 `unknown` 이므로 게이트가 하드 조건으로 보류에 착지하고,
 * 그것이 알려주신 것이 없는 상태의 정직한 결과다.
 */
const EMPTY_CONTEXT: ReunionContext = Object.freeze({
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'unknown',
  contactStatus: 'unknown',
  breakupReason: '',
  desiredOutcome: 'unsure',
  notes: '',
  consentToUsePartnerData: false
});

const recommendationItems = [
  {
    productId: 'love-reading',
    to: '/detail/love-reading',
    eyebrow: '나의 반복 패턴',
    title: '팩폭 연애운',
    body: '이번 관계와 별개로, 사랑할 때 반복되는 내 선택을 보고 싶다면'
  },
  {
    to: '/guiyeondo',
    eyebrow: '두 사람의 인연 지도',
    title: '귀연도',
    body: '재회 여부보다 두 사람의 연결점과 관계의 모양을 함께 살펴보고 싶다면'
  },
  {
    to: '/detail/general-saju',
    eyebrow: '내 전체 흐름',
    title: '정통 종합사주',
    body: '관계 밖의 일·돈·생활까지 지금의 큰 방향을 함께 점검하고 싶다면'
  }
].filter((item) => !('productId' in item) || canDiscoverProduct(item.productId)) as ReadonlyArray<{
  to: string;
  eyebrow: string;
  title: string;
  body: string;
}>;

const readStored = (key: string): string => {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 사파리 프라이빗 모드 등에서 쓰기가 막혀도 리포트는 그대로 읽혀야 한다. */
  }
};

/**
 * 글자 단위 등장(`ud-ink`). 제목 전용이고 16자를 넘기면 쓰지 않는다 —
 * 그 이상에서는 한 자씩 켜지는 것이 읽기를 방해한다.
 * 공백은 자리만 차지하는 span 으로 두고(`data-space`), 스크린리더에는 원문 한 줄을 준다.
 *
 * `letterClass` 는 **글자 span 에** 붙는다. `ud-gilt-text` 를 바깥 래퍼에 붙이면
 * 글자가 사라진다 — `background-clip: text` 는 자기 배경만 클립하는데
 * `-webkit-text-fill-color: transparent` 는 자손까지 상속되므로, 배경이 없는
 * inline-block 자손은 투명한 채로 남는다(실측으로 확인한 실패였다).
 * 금박 그라디언트는 세로 방향이고 글자 높이가 모두 같아서, 글자마다 칠해도
 * 한 줄에 칠한 것과 눈에 같다.
 */
function UdInk({ text, letterClass }: { text: string; letterClass?: string }) {
  const letters = Array.from(text);

  if (letters.length > 16) return <span className={letterClass}>{text}</span>;

  return (
    <span className="ud-ink" aria-label={text}>
      {letters.map((letter, index) => (
        <span
          aria-hidden="true"
          className={letterClass}
          data-space={letter === ' ' ? 'true' : undefined}
          key={`${letter}-${index}`}
          style={{ '--ud-i': index } as CSSProperties}
        >
          {letter === ' ' ? '' : letter}
        </span>
      ))}
    </span>
  );
}

/**
 * CH04 가 이미 계산해 실어 둔 12개월 셀을 **그대로** 꺼낸다.
 *
 * 헤드라인은 새 지표를 만들지 않는다. 여기서 쓰는 값은 `monthLuck[].score` 이고
 * (`timeline.ts` 가 '그대로 쓰되 이름만 바꾼다'고 못박은 그 값),
 * 축 이름은 CH04 의 띠와 같은 `판단 여력` 이다.
 */
function findTimelineCut(payload: ReunionReportPayload): {
  cells: readonly ReunionTimelineCell[];
  labels: Readonly<Record<ReunionTimingLabel, string>>;
} | null {
  for (const chapter of payload.chapters) {
    for (const cut of chapter.cuts) {
      if (cut.payload?.kind === 'timeline12') return cut.payload;
    }
  }
  return null;
}

/**
 * 헤드라인 계측.
 *
 * ★ 카운트업 훅이 **여기** 있는 이유. 이 리포트는 40,000px 가 넘고 컷이 72개다.
 * 훅을 최상위에서 부르면 1.2초 · 약 72프레임 동안 매 프레임 그 트리 전체가
 * 리렌더된다 — 값이 쓰이는 곳은 호 게이지 배지 하나뿐인데도.
 * 소비하는 층으로 내리면 리렌더가 이 컴포넌트와 호까지로 좁혀지고,
 * `children`(근거 층)은 부모가 만든 엘리먼트 참조가 그대로 유지되므로
 * React 가 그 서브트리를 건너뛴다. 계측값과 모션은 그대로다.
 */
function ReportHeadline({
  eyebrow,
  reading,
  badge,
  verdict,
  children
}: {
  eyebrow: string;
  reading: ReunionMeterReading;
  badge?: string;
  verdict?: string;
  children: ReactNode;
}) {
  /* 이 리포트의 유일한 JS 애니메이션이고, 감속 선호에서는 즉시 최종값에 앉는다. */
  const shownScore = useReunionCountUp(reading.kind === 'value' ? reading.value : null);

  return (
    <ReunionMeterHeadline
      ns="rr"
      eyebrow={eyebrow}
      title="이번 달 판단 여력"
      reading={reading}
      unit="점"
      badge={badge}
      verdict={verdict}
      /* `verdictNote` 는 호 안쪽의 절대 배치 리드아웃(`ud-arc-readout`)에 들어간다.
         세 줄이 넘는 문장을 거기에 넣으면 호 박스를 넘어 아래 블록과 겹친다(실측으로 확인).
         그래서 설명은 근거 층의 첫 줄로 내린다 — 호 안에는 배지 · 숫자 · 판정만 남는다. */
      display={shownScore ?? undefined}
    >
      {children}
    </ReunionMeterHeadline>
  );
}

export default function ReunionReportView({ report, formData, reunionContext }: ReunionReportViewProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(pageRef);

  const context = useMemo(
    () => reunionContext || formData.reunionContext || EMPTY_CONTEXT,
    [formData.reunionContext, reunionContext]
  );

  const [selfCheck, setSelfCheck] = useState<ReunionSelfCheck>(createEmptyReunionSelfCheck);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [deadline, setDeadline] = useState(() => readStored(DEADLINE_KEY));
  const [decision, setDecision] = useState(() => readStored(DECISION_KEY));
  const [saveNote, setSaveNote] = useState('');
  const [activeMonth, setActiveMonth] = useState<number | null>(null);

  const name = (report.customerName || formData.name || '').trim() || '그대';

  /**
   * 밴드 계산은 **정규화된 양력** 생일을 요구한다(`ageBand.ts:94`).
   * `normalizeIntakeFormData` 는 `birthDate` 를 trim 만 하고 음력→양력 변환을 하지 않으므로,
   * 음력 입력을 그대로 넘기면 경계 나이에서 밴드가 한 칸 튄다.
   * 양력 값을 여기까지 내리기 전까지는 음력 입력을 `null` 로 떨어뜨려 `neutral` 에 착지시킨다 —
   * 중립 밴드는 어휘만 중립으로 바꾸고 아무것도 잘못 말하지 않는다.
   */
  const solarBirthDate = formData.calendar === 'lunar' ? null : formData.birthDate || null;

  const payload = useMemo(
    () =>
      buildReunionReportPayload({
        report,
        context,
        name,
        birthDate: solarBirthDate,
        selfCheck,
        /* CH02 판독표의 '거절이나 중단 요청' 한 칸은 게이트의 하드 조건이다.
           수집만 하고 버리면 가장 중요한 신호를 읽고도 연락 설계가 그대로 남는다. */
        observedSignals: checked
      }),
    [checked, context, name, report, selfCheck, solarBirthDate]
  );

  const evidence = useMemo(() => buildReunionChapterEvidence(report), [report]);
  const dayunLabel = useMemo(() => formatReunionDayunLabel(report), [report]);

  const handleSelfCheck = useCallback((id: keyof ReunionSelfCheck, answer: ReunionSelfCheckAnswer) => {
    setSelfCheck((current) => ({ ...current, [id]: answer }));
  }, []);

  const handleToggle = useCallback((id: string) => {
    setChecked((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const handleDeadline = useCallback((value: string) => {
    setDeadline(value);
    writeStored(DEADLINE_KEY, value);
  }, []);

  const handleSaveDecision = useCallback(() => {
    writeStored(DECISION_KEY, decision);
    setSaveNote(decision ? '이 기기에 저장했어요.' : '적어 두신 내용이 없어 저장하지 않았어요.');
  }, [decision]);

  const interactions: ReunionCutInteractions = useMemo(
    () => ({
      selfCheck,
      onSelfCheck: handleSelfCheck,
      checked,
      onToggle: handleToggle,
      deadline,
      onDeadline: handleDeadline,
      decision,
      onDecision: setDecision,
      onSaveDecision: handleSaveDecision,
      saveNote,
      activeMonth,
      onSelectMonth: setActiveMonth
    }),
    [
      activeMonth,
      checked,
      deadline,
      decision,
      handleDeadline,
      handleSaveDecision,
      handleSelfCheck,
      handleToggle,
      saveNote,
      selfCheck
    ]
  );

  const [shareStatus, setShareStatus] = useState('');
  const handleShare = async () => {
    const title = '운월당 재회운';
    const text =
      '상대의 마음이나 재회 확률을 단정하지 않고, 두 사람의 명리 흐름과 현실적인 연락 조건을 함께 살펴보는 재회운 리포트입니다.';
    const url = typeof window === 'undefined' ? '' : `${window.location.origin}/detail/love-reunion`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        setShareStatus('공유 화면을 열었어요.');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setShareStatus('공유 문구와 링크를 복사했어요.');
      } else {
        setShareStatus('이 브라우저에서는 링크 복사를 지원하지 않아요.');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareStatus('공유하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  const deferred = payload.gate.state === 'deferred';

  /**
   * 표지 다음 한 화면을 채우는 계측. `ReunionMeterReading` 이 세 상태를 갈라 놓으므로
   * 값이 없는 경로에서 숫자가 나가는 일이 마크업 층에서 막힌다.
   *
   * 보류 판정에서는 **값을 그리지 않는다.** 같은 화면에서 '오늘은 읽기만 하셔도 돼요'라고
   * 해 놓고 최상단에 점수를 세우면 그 판정이 곧바로 무력해진다.
   */
  const timeline = useMemo(() => findTimelineCut(payload), [payload]);
  const monthCell = timeline && timeline.cells.length > 0 ? timeline.cells[0] : null;

  const headlineReading: ReunionMeterReading = deferred
    ? { kind: 'hold', note: '오늘은 계측을 접어 뒀어요. 아래 장은 읽기만 하셔도 됩니다.' }
    : monthCell
      ? {
          kind: 'value',
          value: monthCell.score,
          ariaLabel: `${monthCell.year}년 ${monthCell.month}월 ${monthCell.ganzhi} · 판단 여력 ${monthCell.score}점`
        }
      : { kind: 'hold', note: '이 구간을 계측할 월별 자료가 전달되지 않아 비워 뒀어요.' };

  return (
    <div className="rr-page ud-grain ud-vignette" ref={pageRef}>
      {/* 문서 단위 SVG defs — 페이지당 한 번. 화면에 아무것도 그리지 않는다. */}
      <UdOrnamentDefs />

      {/* Report.tsx 는 이 뷰를 공용 `.premium-report-topbar` 앞에서 반환하므로
          /report/love-reunion 에는 이 바가 없으면 앱으로 돌아갈 길이 사라진다.
          `.reunion-topbar` 는 appShell.css 가 높이를 주는 통합 상단 바 이름이다. */}
      <header className="reunion-topbar rr-topbar ud-glass">
        <Link to="/" className="rr-topbar-link ud-pressable" aria-label="운월당 홈">
          운월당
        </Link>
        <Link to="/my" className="rr-topbar-link ud-pressable">
          보관함
        </Link>
      </header>

      <main className="rr-main">
        {/* ── 표지 ── 이름을 부르는 한 화면. 자료는 아래 헤드라인이 전부 맡는다. */}
        <section className="rr-cover" aria-labelledby="rr-title" data-reveal>
          {/* 유료 결과물의 첫 화면이 '검정 위 중앙정렬 텍스트'로 시작하고 있었다.
              상세페이지가 쓰는 것과 같은 코너 장식을 얹어 표지를 액자로 만든다. */}
          <UdCorners kind="spandrel" size={24} inset={6} className="rr-cover-corners" />
          <span className="rr-cover-seal ud-rise" aria-hidden="true">
            <UdMedallion glyph="crescent" size={58} />
          </span>
          <p className="rr-cover-kicker ud-kicker ud-rise">운월당 · 재회운</p>
          <h1 className="rr-cover-title" id="rr-title">
            <span className="rr-cover-name">
              <UdInk letterClass="ud-gilt-text" text={`${name}님,`} />
            </span>
            <span className="rr-cover-line">여섯 질문에 차례로 답해 드릴게요</span>
          </h1>
          <p className="rr-cover-lead ud-rise">
            기대가 아니라 행동을 기준으로 다음 한 걸음만 정리해요. 재회를 확률로 단정하지 않고, 멈춰야
            하는 경우도 같은 분량으로 씁니다.
          </p>
          <UdChapterRule className="rr-cover-rule ud-rise" />
        </section>

        {/* ── 헤드라인 ── 표지 다음 한 화면에서 '내 결과'가 잡히는 자리.
            값은 CH04 가 이미 계산해 둔 셀을 그대로 쓰고, 축 이름도 그 장과 같다. */}
        {/* 영역 이름은 `ud-cardhead` 의 큰 줄과 같다. 같은 문장을 숨은 제목으로 한 번 더
            두면 스크린리더가 두 번 읽는다 — `aria-label` 로 영역만 이름 짓는다. */}
        <section className="rr-headline-wrap" aria-label="이번 달 판단 여력" data-reveal>
          <ReportHeadline
            eyebrow={`${name}님의`}
            reading={headlineReading}
            badge={
              monthCell
                ? `${monthCell.year}.${String(monthCell.month).padStart(2, '0')} · ${monthCell.ganzhi}`
                : undefined
            }
            verdict={monthCell && timeline ? timeline.labels[monthCell.label] : undefined}
          >
            {/* 게이트가 보류면 이 자리에 숫자를 한 개도 그리지 않는다. 그 상태에서
                '이 숫자는…' 이라고 쓰면 화면에 없는 값을 가리키게 된다.
                없는 값을 지어내는 것은 아니지만, 보여주지 않은 값을 문장이 참조하는
                것도 같은 종류의 어긋남이다. 세 갈래를 타입이 이미 들고 있으므로
                분기 비용이 없다. */}
            {headlineReading.kind === 'value' ? (
              <p className="rr-headline-note">
                이 숫자는 {name}님 명식의 월별 흐름이에요. 상대의 마음이나 두 사람의 앞일을 재는 값이
                아니고, 같은 값을 열두 달로 펼친 표가 네 번째 장에 있어요.
              </p>
            ) : (
              <p className="rr-headline-note">
                이 칸의 값은 {name}님 명식의 월별 흐름에서 나와요. 오늘은 계측을 접어 뒀고, 같은 값을
                열두 달로 펼친 표가 네 번째 장에 있어요.
              </p>
            )}
            <dl className="rr-headline-meta ud-surface-2 ud-inlay--thin">
              <div className="ud-tick" style={{ '--ud-i': 0 } as CSSProperties}>
                <dt className="ud-label">발행</dt>
                <dd className="ud-num">{report.serialNumber}</dd>
              </div>
              <div className="ud-tick" style={{ '--ud-i': 1 } as CSSProperties}>
                <dt className="ud-label">기준 명식</dt>
                <dd className="ud-num">{report.birthLabel}</dd>
              </div>
              <div className="ud-tick" style={{ '--ud-i': 2 } as CSSProperties}>
                <dt className="ud-label">현재 흐름</dt>
                <dd className="ud-hanja">{dayunLabel}</dd>
              </div>
            </dl>
          </ReportHeadline>
        </section>

        {/* 자가체크를 누르는 순간 일곱 장이 접히고 탭 가능 요소가 크게 줄어든다.
            그 변화를 알리는 문장이 없으면 스크린리더 사용자는 아무 안내 없이
            리포트의 8분의 7이 사라진 상태에 놓인다. */}
        <p className="reunion-visually-hidden" role="status" aria-live="polite">
          {deferred
            ? '오늘은 나머지 장을 접어 두었어요. 원하시면 각 장에서 펴 보실 수 있어요.'
            : ''}
        </p>

        <div className="rr-rail">
          {/* 실 위를 지나가는 빛. 페이지당 1개, 감속 선호에서 멈춘다. */}
          <span className="rr-rail-spark ud-spark" aria-hidden="true" />
          {payload.chapters.map((chapter) => {
            const chapterEvidence = evidence[chapter.id];
            const collapsed = deferred && chapter.index > 0;
            /**
             * 접는 장에서도 접지 않는 컷 두 종류.
             *
             * 1. **삭제 불가 문구가 실린 컷.** 닫힌 `<details>` 안은 브라우저가 렌더하지 않아
             *    접근성 트리에서도 사라진다. 그대로 접으면 `safety-boundary`(통제·모욕·위협 안내)와
             *    `legal-notice` 가 **독자가 가장 취약하다고 판정된 바로 그 상태에서** 없어진다.
             * 2. **신호 판독표.** 여기서 켠 '거절이나 중단 요청' 한 칸이 게이트를 보류로 뒤집는다.
             *    판정을 만든 컨트롤을 그 판정으로 숨기면 독자가 자기 표시를 되돌릴 수 없다.
             */
            const staysOpen = (cut: (typeof chapter.cuts)[number]) =>
              Boolean(cut.undeletable) || cut.payload?.kind === 'signal-table';
            const alwaysOnCuts = collapsed ? chapter.cuts.filter(staysOpen) : [];
            const collapsibleCuts = collapsed
              ? chapter.cuts.filter((cut) => !staysOpen(cut))
              : chapter.cuts;

            const renderCuts = (list: typeof chapter.cuts, className: string) =>
              list.length > 0 ? (
                <div className={className}>
                  {list.map((cut) => (
                    <ReunionCutView
                      cut={cut}
                      name={name}
                      dayunLabel={dayunLabel}
                      interactions={interactions}
                      key={cut.id}
                    />
                  ))}
                </div>
              ) : null;

            const cuts = renderCuts(collapsibleCuts, 'rr-cuts');
            const evidenceBlock =
              chapterEvidence && chapterEvidence.entries.length > 0 ? (
                /* 근거는 기본으로 펼쳐 둔다. goblin 리포트가 개인화를 전부 <details> 뒤에
                   숨겨 첫 스크롤에서 아무것도 안 보이던 실패를 반복하지 않는다.
                   밴드의 `expandedByDefault` 는 장 머리의 '먼저 보셔도 좋은 장' 표시로 나간다. */
                <details className="rr-evidence" open data-reveal>
                  <summary>
                    <span className="rr-mark is-calculated" aria-hidden="true">
                      ◆
                    </span>
                    <span className="rr-evidence-title">{chapterEvidence.title}</span>
                  </summary>
                  <p className="rr-evidence-note ud-rise">
                    {chapterEvidence.note.replace(/\{name\}/gu, name)}
                  </p>
                  <dl className="rr-evidence-list">
                    {chapterEvidence.entries.map((entry, index) => (
                      <div
                        className="ud-tick"
                        key={entry.id}
                        style={{ '--ud-i': index } as CSSProperties}
                      >
                        <dt>{entry.label}</dt>
                        <dd>{entry.body}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null;

            const titleId = `rr-chapter-${chapter.id}`;

            return (
              <section
                className="rr-chapter"
                data-chapter={chapter.id}
                data-index={chapter.index}
                aria-labelledby={titleId}
                key={chapter.id}
              >
                <span className="rr-rail-node" aria-hidden="true" />
                <header className="rr-chapter-head" data-reveal>
                  {/* 장 머리도 액자로 잡는다 — 상세페이지의 컷 무대와 같은 뇌문이다. */}
                  <UdCorners kind="fret" size={18} inset={2} className="rr-chapter-corners" />
                  {/* 장 번호는 바로 아래 눈썹()이 이미 말한다.
                      같은 숫자를 구분선 가운데에 또 얹으면 초승달 문양과 겹친다. */}
                  <UdChapterRule className="rr-chapter-mark" />
                  <p className="rr-chapter-kicker ud-kicker ud-rise">
                    CHAPTER {String(chapter.index).padStart(2, '0')}
                    {/* 밴드가 고른 장. 나이·세대를 화면 문장에 쓰지 않으면서 순서만 바꾼다.
                        보류 판정에서는 붙이지 않는다 — 같은 화면에서 '오늘은 읽기만 하셔도 돼요'라고
                        해 놓고 접힌 장을 열어 보라고 권하는 꼴이 된다. */}
                    {chapter.expandedByDefault && chapter.index > 0 && !deferred ? (
                      <span className="rr-chapter-flag">먼저 보셔도 좋은 장</span>
                    ) : null}
                  </p>
                  <div className="rr-chapter-veil ud-veil">
                    <h2 className="rr-chapter-title" id={titleId}>
                      {chapter.questionTitle}
                    </h2>
                  </div>
                  <p className="rr-chapter-sub ud-rise">{chapter.subtitle}</p>
                  <ol className="rr-chapter-outline" role="list">
                    {chapter.outline.map((line, index) => (
                      <li className="ud-tick" key={line} style={{ '--ud-i': index } as CSSProperties}>
                        {line}
                      </li>
                    ))}
                  </ol>
                </header>

                {collapsed ? (
                  <>
                    {renderCuts(alwaysOnCuts, 'rr-cuts rr-cuts--always')}
                    <details className="rr-collapsed">
                      {/* 접힌 장 요약 버튼이 일곱 개 생긴다. 문구가 전부 같으면
                          스크린리더의 컨트롤 목록에서 서로 구분되지 않는다. */}
                      <summary>
                        {chapter.questionTitle} — 오늘은 접어 뒀어요. 읽고 싶으시면 눌러서 펴 보셔도 돼요.
                      </summary>
                      {cuts}
                      {evidenceBlock}
                    </details>
                  </>
                ) : (
                  <>
                    {cuts}
                    {evidenceBlock}
                  </>
                )}

                {chapter.reducedReason ? (
                  <p className="rr-reduced">{chapter.reducedReason}</p>
                ) : null}
                <p className="rr-chapter-foot">{chapter.footerNote}</p>
                <UdFretDivider className="rr-chapter-seam" scale="narrow" />
              </section>
            );
          })}
        </div>

        {/* 추천은 편지 밖의 별도 블록이다. 편지 안에 넣는 순간 편지 전체가 판매 도구로 읽힌다.
            그리고 게이트가 보류인 독자에게는 렌더하지 않는다(§6-C-2). */}
        {payload.allowPurchaseCta && recommendationItems.length > 0 ? (
          <section className="rr-next" aria-labelledby="rr-next-title" data-reveal>
            <h2 className="ud-subtitle ud-rise" id="rr-next-title">
              질문이 달라졌을 때만 추천해요
            </h2>
            <div className="rr-next-grid">
              {recommendationItems.map((item, index) => (
                <Link
                  className="ud-tick ud-pressable"
                  key={item.to}
                  style={{ '--ud-i': index } as CSSProperties}
                  to={item.to}
                >
                  <small className="ud-label">{item.eyebrow}</small>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <span>
                    상품 보기 <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* 공유 블록은 상세페이지 링크와 마케팅 문구를 복사한다.
            보류 판정을 받은 독자에게는 추천 블록과 같은 이유로 렌더하지 않는다(§6-C-2). */}
        {deferred ? null : (
          <section className="rr-share" aria-label="리포트 공유" data-reveal>
            <Sparkles size={18} aria-hidden="true" />
            <div>
              <strong>개인정보 없이 재회운 소개만 공유해요</strong>
              <p>두 사람의 이름·생년월일·이별 사유는 공유하지 않습니다.</p>
            </div>
            <button type="button" className="ud-pressable" onClick={handleShare}>
              <LinkIcon size={16} aria-hidden="true" />
              공유하기
            </button>
            <small role="status" aria-live="polite">
              {shareStatus}
            </small>
          </section>
        )}

        <footer className="rr-disclaimer">
          이 리포트는 전통 명리학 기반 참고 자료입니다. 상대방의 감정·연락·재회를 보장하지 않으며,
          차단이나 명시적 거절이 있으면 모든 접촉보다 상대의 경계와 사용자의 안전을 우선하세요.
        </footer>
      </main>
    </div>
  );
}
