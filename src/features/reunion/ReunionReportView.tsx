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
 * 안전 계약(타협 불가):
 *   - CH00 판단 게이트가 `deferred` 면 나머지 장을 접고 **결제·다음 상품 유도를 렌더하지 않는다**.
 *   - 삭제 불가 문구 7개는 어떤 상태에서도 화면에 남는다.
 *   - 신호 판독표는 이미 일어난 대화의 속성만 다루고 체크를 저장하지 않는다.
 */

import { ArrowRight, Link as LinkIcon, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { IntakeFormData } from '../../api/mockData';
import {
  REUNION_CONTEXT_VERSION,
  buildReunionReportPayload,
  createEmptyReunionSelfCheck,
  type ReunionContext,
  type ReunionSelfCheck,
  type ReunionSelfCheckAnswer
} from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';
import { canDiscoverProduct } from '../../products/registry';
import '../../styles/reunion-report.css';
import ReunionCutView, { type ReunionCutInteractions } from './reunionReportCuts';
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

export default function ReunionReportView({ report, formData, reunionContext }: ReunionReportViewProps) {
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

  return (
    <div className="rr-page">
      {/* Report.tsx 는 이 뷰를 공용 `.premium-report-topbar` 앞에서 반환하므로
          /report/love-reunion 에는 이 바가 없으면 앱으로 돌아갈 길이 사라진다.
          `.reunion-topbar` 는 appShell.css 가 높이를 주는 통합 상단 바 이름이다. */}
      <header className="reunion-topbar rr-topbar">
        <Link to="/" className="rr-topbar-link" aria-label="운월당 홈">
          운월당
        </Link>
        <Link to="/my" className="rr-topbar-link">
          보관함
        </Link>
      </header>

      <main className="rr-main">
        <section className="rr-cover" aria-labelledby="rr-title">
          <p className="rr-cover-kicker">운월당 · 재회운</p>
          <h1 id="rr-title">
            {name}님,
            <br />
            여섯 질문에 차례로 답해 드릴게요
          </h1>
          <p className="rr-cover-lead">
            기대가 아니라 행동을 기준으로 다음 한 걸음만 정리해요. 재회를 확률로 단정하지 않고, 멈춰야
            하는 경우도 같은 분량으로 씁니다.
          </p>
          <dl className="rr-cover-meta">
            <div>
              <dt>발행</dt>
              <dd>{report.serialNumber}</dd>
            </div>
            <div>
              <dt>기준 명식</dt>
              <dd>{report.birthLabel}</dd>
            </div>
            <div>
              <dt>현재 흐름</dt>
              <dd>{dayunLabel}</dd>
            </div>
          </dl>
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
                <details className="rr-evidence" open>
                  <summary>
                    <span className="rr-mark is-calculated" aria-hidden="true">
                      ◆
                    </span>
                    {chapterEvidence.title}
                  </summary>
                  <p className="rr-evidence-note">
                    {chapterEvidence.note.replace(/\{name\}/gu, name)}
                  </p>
                  <dl className="rr-evidence-list">
                    {chapterEvidence.entries.map((entry) => (
                      <div key={entry.id}>
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
                <header className="rr-chapter-head">
                  <p className="rr-chapter-kicker">
                    CHAPTER {String(chapter.index).padStart(2, '0')}
                    {/* 밴드가 고른 장. 나이·세대를 화면 문장에 쓰지 않으면서 순서만 바꾼다.
                        보류 판정에서는 붙이지 않는다 — 같은 화면에서 '오늘은 읽기만 하셔도 돼요'라고
                        해 놓고 접힌 장을 열어 보라고 권하는 꼴이 된다. */}
                    {chapter.expandedByDefault && chapter.index > 0 && !deferred ? (
                      <span className="rr-chapter-flag">먼저 보셔도 좋은 장</span>
                    ) : null}
                  </p>
                  <h2 className="rr-chapter-title" id={titleId}>
                    {chapter.questionTitle}
                  </h2>
                  <p className="rr-chapter-sub">{chapter.subtitle}</p>
                  <ol className="rr-chapter-outline" role="list">
                    {chapter.outline.map((line) => (
                      <li key={line}>{line}</li>
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
              </section>
            );
          })}
        </div>

        {/* 추천은 편지 밖의 별도 블록이다. 편지 안에 넣는 순간 편지 전체가 판매 도구로 읽힌다.
            그리고 게이트가 보류인 독자에게는 렌더하지 않는다(§6-C-2). */}
        {payload.allowPurchaseCta && recommendationItems.length > 0 ? (
          <section className="rr-next" aria-labelledby="rr-next-title">
            <h2 id="rr-next-title">질문이 달라졌을 때만 추천해요</h2>
            <div className="rr-next-grid">
              {recommendationItems.map((item) => (
                <Link key={item.to} to={item.to}>
                  <small>{item.eyebrow}</small>
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
          <section className="rr-share" aria-label="리포트 공유">
            <Sparkles size={18} aria-hidden="true" />
            <div>
              <strong>개인정보 없이 재회운 소개만 공유해요</strong>
              <p>두 사람의 이름·생년월일·이별 사유는 공유하지 않습니다.</p>
            </div>
            <button type="button" onClick={handleShare}>
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
