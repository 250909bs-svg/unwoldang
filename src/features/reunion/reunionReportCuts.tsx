/**
 * 재회운 리포트 · 컷 렌더러 (명세 §3, §5).
 *
 * 판정·집계·날짜·차트는 전부 `src/lib/reunion` 이 결정론으로 만들어 넘겨준다.
 * 이 파일은 **그린다.** 여기서 문장을 만들거나 숫자를 계산하지 않는다 —
 * 화면에서 값을 지어내는 순간 근거 추적성이 끊긴다.
 *
 * 렌더러 계약(§5):
 *   - `beat` 컷은 `beatSize` 만 보고 높이를 정한다. 내용 없음, 순검정.
 *   - `undeletable` 컷의 문구는 어떤 상태에서도 가리거나 빼지 않는다.
 *     (예외는 `deadline-owner` 하나다 — §6-F 가 '독자 입력 후에만'으로 못박았고,
 *      입력 전에는 서버 제안 구간을 독자가 정한 것처럼 귀속시키게 되기 때문이다.)
 *   - 줄바꿈은 데이터의 `\n` 이 정한다. 자동 wrap 에 맡기지 않는다(`white-space: pre-line`).
 *   - 장식 요소는 `aria-hidden`.
 *
 * `cut.mask` 는 이 라우트에서 해석하지 않는다. `/report/love-reunion` 은 결제·접근 게이트를
 * 통과한 뒤에만 렌더되므로 전량 공개이고, 무료 구간 마스킹은 `ReunionPreview.tsx` 소관이다.
 */

import { Check, Lock, Minus, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import {
  REUNION_OBSERVABLE_SIGNALS,
  formatReadinessBasisSplit,
  formatReadinessTally,
  type ReunionCut,
  type ReunionSelfCheck,
  type ReunionSelfCheckAnswer
} from '../../lib/reunion';
import ReunionPanelPicture from './ReunionPanelPicture';
import {
  ReunionMeterBand,
  ReunionMeterGauge,
  ReunionMeterTally,
  ReunionMeterTimeline,
  type ReunionMeterState
} from './reunionMeters';

/* ── 독자 입력 상태 ──────────────────────────────────────────── */

export interface ReunionCutInteractions {
  selfCheck: ReunionSelfCheck;
  onSelfCheck: (id: keyof ReunionSelfCheck, answer: ReunionSelfCheckAnswer) => void;
  checked: Readonly<Record<string, boolean>>;
  onToggle: (id: string) => void;
  deadline: string;
  onDeadline: (value: string) => void;
  decision: string;
  onDecision: (value: string) => void;
  onSaveDecision: () => void;
  saveNote: string;
  activeMonth: number | null;
  onSelectMonth: (index: number | null) => void;
}

export interface ReunionCutViewProps {
  cut: ReunionCut;
  name: string;
  /** `乙巳 대운 · 2024 ~ 2033`. 나이 표기를 연도 구간으로 바꾼 값(§2-4). */
  dayunLabel: string;
  interactions: ReunionCutInteractions;
}

/* ── 작은 조각 ───────────────────────────────────────────────── */

/** ◇ 알려주신 것 / ◆ 제가 계산한 것. 기호는 장식이라 스크린리더에는 말로 읽힌다. */
function BasisMark({ basis }: { basis: 'input' | 'calculated' }) {
  return (
    <>
      <span className={`rr-mark is-${basis}`} aria-hidden="true">
        {basis === 'input' ? '◇' : '◆'}
      </span>
      <span className="reunion-visually-hidden">
        {basis === 'input' ? '알려주신 것' : '제가 계산한 것'}
      </span>
    </>
  );
}

const STATE_ICON = {
  met: Check,
  unmet: X,
  unknown: Minus
} as const;

function StateIcon({ state }: { state: 'met' | 'unmet' | 'unknown' }) {
  const Icon = STATE_ICON[state];
  return <Icon size={15} aria-hidden="true" />;
}

/**
 * 캡션이 패널의 **라벨**로 읽혀야 하는 payload 종류.
 * 여기 없는 종류에서는 캡션이 그림 아래 설명으로 들어간다.
 * (`readiness` 의 `확률이 아니라 조건 개수예요.` 와 `timeline12` 의 삭제 불가 캡션은
 *  명세가 '바로 아래'·'하단'으로 못박았으므로 반드시 아래에 남는다.)
 */
const CAPTION_ABOVE = new Set([
  'input-echo',
  'gate-check',
  'pillars',
  'signal-table',
  'checklist',
  'condition-cards',
  'prohibited',
  'legal'
]);

const READINESS_STATE_WORD: Record<'met' | 'unmet' | 'unknown', string> = {
  met: '확인됨',
  unmet: '아직 확인 안 됨',
  unknown: '판단 보류'
};

/** 점 색만으로는 상태가 전달되지 않는다. `readiness` 와 같은 규칙으로 말도 함께 내보낸다. */
const CHECKPOINT_STATE_WORD: Record<'confirmed' | 'unconfirmed' | 'deferred', string> = {
  confirmed: '확인됨',
  unconfirmed: '아직 확인 못 함',
  deferred: '오늘은 보류'
};

function toBandState(label: 'open' | 'normal' | 'hold'): ReunionMeterState {
  return label;
}

/* ── payload 별 블록 ─────────────────────────────────────────── */

function CutPayload({ cut, name, dayunLabel, interactions }: ReunionCutViewProps) {
  const payload = cut.payload;
  if (!payload) return null;

  switch (payload.kind) {
    /* CH00 0-1 입력 되인용. 라벨은 '{이름}님이 알려주신 것'. 미확인 스탬프는 쓰지 않는다. */
    case 'input-echo':
      return (
        <dl className="rr-echo">
          {payload.rows.map((row) => (
            <div className="rr-echo-row" key={row.label}>
              <dt>
                <BasisMark basis="input" />
                {row.label}
              </dt>
              <dd>
                <q>{row.value}</q>
              </dd>
            </div>
          ))}
        </dl>
      );

    /* CH00 0-4 판단 게이트. 전부 사실 확인형 문장이고 감정을 묻지 않는다. */
    case 'gate-check':
      return (
        <ul className="rr-gate-check" role="list">
          {payload.questions.map((question) => {
            const id = question.id as keyof ReunionSelfCheck;
            const answer = interactions.selfCheck[id];
            return (
              <li className="rr-gate-question" key={question.id}>
                <p id={`gate-${question.id}`}>{question.label}</p>
                <div className="rr-gate-answers" role="group" aria-labelledby={`gate-${question.id}`}>
                  {(
                    [
                      ['ok', '평소대로였어요'],
                      ['unstable', '흔들렸어요']
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={answer === value ? 'rr-choice is-on' : 'rr-choice'}
                      aria-pressed={answer === value}
                      onClick={() => interactions.onSelfCheck(id, answer === value ? 'unknown' : value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      );

    /* CH00 0-2 · 0-4 판정 카드. ok 면 여섯 질문 목차, deferred 면 사유. */
    case 'gate-verdict':
      return (
        <div className={`rr-verdict is-${payload.state}`}>
          <p className="rr-verdict-state">
            {payload.state === 'ok' ? '지금 읽으셔도 괜찮아요' : '오늘은 읽기만 하셔도 돼요'}
          </p>
          {payload.state === 'deferred' ? (
            <ul className="rr-verdict-reasons" role="list">
              {payload.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <ol className="rr-toc" role="list">
              {payload.toc.map((question) => (
                <li key={question}>
                  <span className="rr-toc-dot" aria-hidden="true" />
                  {question}
                </li>
              ))}
            </ol>
          )}
        </div>
      );

    /* CH01 1-2 사주 원국 패널. 값은 전부 엔진이 계산한 것이라 ◆ 쪽이다. */
    case 'pillars':
      return (
        <div className="rr-pillars">
          <table className="rr-pillars-table">
            <caption className="reunion-visually-hidden">
              시주 · 일주 · 월주 · 년주 네 기둥의 천간, 지지, 십성, 지장간
            </caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="reunion-visually-hidden">항목</span>
                </th>
                {payload.cells.map((cell) => (
                  <th scope="col" key={cell.pillar} className={cell.isDayMaster ? 'is-day' : undefined}>
                    {cell.pillar}
                    {cell.isDayMaster ? <span className="rr-pillars-badge">나</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">천간</th>
                {payload.cells.map((cell) => (
                  <td key={cell.pillar} className={cell.isDayMaster ? 'is-day' : undefined}>
                    <strong className="rr-pillars-glyph">{cell.stemHanja || cell.stem}</strong>
                    <span className="rr-pillars-ko">{cell.stem}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">지지</th>
                {payload.cells.map((cell) => (
                  <td key={cell.pillar}>
                    <strong className="rr-pillars-glyph">{cell.branchHanja || cell.branch}</strong>
                    <span className="rr-pillars-ko">{cell.branch}</span>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">십성</th>
                {payload.cells.map((cell) => (
                  <td key={cell.pillar}>{cell.stemTenGod}</td>
                ))}
              </tr>
              <tr>
                <th scope="row">지장간</th>
                {payload.cells.map((cell) => (
                  <td key={cell.pillar}>{cell.branchMainStem}</td>
                ))}
              </tr>
            </tbody>
          </table>
          {payload.tenGodBasisNote ? (
            <p className="rr-pillars-note">{payload.tenGodBasisNote}</p>
          ) : null}
        </div>
      );

    /* CH01 1-3 네 칸 요약.
       대운은 나이가 아니라 **연도 구간**으로 표기한다(§2-4). `currentDayun.range` 는
       `30세 ~ 39세` 문자열이라 그대로 흘리면 밴드 금지 규칙과 정면 충돌한다. */
    case 'facts4':
      return (
        <dl className="rr-facts">
          {payload.rows.map((row) => (
            <div key={row.label}>
              <dt>
                <BasisMark basis={row.basis} />
                {row.label}
              </dt>
              <dd>{row.label === '현재 흐름' ? dayunLabel : row.value}</dd>
            </div>
          ))}
        </dl>
      );

    case 'elements':
      return (
        <ul className="rr-elements" role="list">
          {payload.items.map((item) => (
            <li key={item.label}>
              <span className="rr-elements-name">{item.label}</span>
              <span className="rr-elements-count">{item.value}</span>
            </li>
          ))}
        </ul>
      );

    /* CH02 2-2 궁합 4축. %가 아니라 방향 3단계 + 근거부족.
       '근거 신뢰도'는 관계 점수와 색·크기를 완전히 분리해 그린다. */
    case 'axes':
      return (
        <>
          <ul className="rr-axes" role="list">
            {payload.axes.map((axis) => (
              <li className={`rr-axis is-${axis.direction}`} key={axis.id}>
                <p className="rr-axis-head">
                  <span className="rr-axis-icon" aria-hidden="true">
                    {axis.directionIcon}
                  </span>
                  <span className="rr-axis-label">{axis.label}</span>
                </p>
                <p className="rr-axis-direction">{axis.directionLabel}</p>
                <p className="rr-axis-statement">{axis.withheldReason || axis.statement}</p>
                {/* 신뢰도 꼬리가 없는 배지에 라벨을 지어 붙이지 않는다.
                    관계 점수와 색·크기를 완전히 분리해 그리는 것이 이 줄의 전부다. */}
                {axis.evidenceConfidenceLabel ? (
                  <p className="rr-axis-confidence">근거 신뢰도 · {axis.evidenceConfidenceLabel}</p>
                ) : null}
              </li>
            ))}
          </ul>
          {payload.axes.length === 0 ? (
            <p className="rr-empty">두 사람의 맞물림을 계산할 근거가 아직 확정되지 않았어요.</p>
          ) : null}
          {payload.precisionNote ? <p className="rr-footnote">{payload.precisionNote}</p> : null}
        </>
      );

    /* CH02 2-3 신호 판독표. 항목은 이미 일어난 대화의 속성만이다.
       체크는 저장되지 않는다 — 저장되는 순간 상대 관찰 트래커가 된다(§6-B). */
    case 'signal-table':
      return (
        <div className="rr-signals">
          <p className="rr-signals-head" aria-hidden="true">
            <span>내가 본 것</span>
            <span>이건 사실</span>
            <span>이건 추측</span>
          </p>
          <ul role="list">
            {payload.items.map((item) => {
              const on = Boolean(interactions.checked[item.id]);
              const note = REUNION_OBSERVABLE_SIGNALS.find((signal) => signal.id === item.id)?.guessNote;
              return (
                <li className={on ? 'rr-signal is-on' : 'rr-signal'} key={item.id}>
                  <button
                    type="button"
                    className="rr-signal-toggle"
                    aria-pressed={on}
                    onClick={() => interactions.onToggle(item.id)}
                  >
                    <span className="rr-signal-box" aria-hidden="true">
                      {on ? <Check size={13} /> : null}
                    </span>
                    {item.label}
                  </button>
                  {/* 열 머리글(`.rr-signals-head`)은 560px 미만에서 display:none 이고
                      장식이라 aria-hidden 이다. 사실 칸과 추측 칸을 가르는 것이 이 컷의
                      존재 이유이므로, 구분은 행 안의 라벨이 직접 들고 있어야 한다. */}
                  <p className="rr-signal-fact">
                    <span className="rr-signal-tag">이건 사실 · </span>
                    {on ? '사실 칸' : '아직 비어 있음'}
                  </p>
                  <p className="rr-signal-guess">
                    <span className="rr-signal-tag">이건 추측 · </span>
                    {on && note ? note : '아직 없음'}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      );

    /* CH03 3-1 판정 게이지. 확률이 아니라 조건 개수다. */
    case 'readiness': {
      const readiness = payload.readiness;
      if (readiness.withheld) {
        return (
          <div className="rr-verdict is-deferred">
            <p className="rr-verdict-state">
              <Lock size={16} aria-hidden="true" /> 판정 보류
            </p>
            <p>{readiness.withheldReason}</p>
          </div>
        );
      }
      return (
        <div className="rr-readiness">
          <ReunionMeterGauge
            ns="rr"
            ariaLabel={formatReadinessTally(readiness)}
            cells={readiness.items.map((item) => ({ id: item.id, state: item.state }))}
          />
          <ReunionMeterTally
            ns="rr"
            items={[
              { id: 'met', num: String(readiness.met), unit: '개', label: '확인된 조건', state: 'met' },
              { id: 'unmet', num: String(readiness.unmet), unit: '개', label: '아직 확인 안 됨', state: 'unmet' },
              {
                id: 'unknown',
                num: String(readiness.unknown),
                unit: '개',
                label: '판단 보류',
                state: 'unknown'
              }
            ]}
          />
          {/* 다섯 칸은 출처가 섞여 있다. 한 숫자로 합산하면서 ◇/◆ 구분을 지우면
              프롤로그에서 선언한 '계산한 것과 알려주신 것을 섞지 않는다'가 같은 리포트 안에서 깨진다. */}
          <p className="rr-readiness-basis">{formatReadinessBasisSplit(readiness)}</p>
          <ul className="rr-readiness-list" role="list">
            {readiness.items.map((item) => (
              <li className={`rr-readiness-item is-${item.state}`} key={item.id}>
                <p className="rr-readiness-label">
                  <span className="rr-readiness-state" aria-hidden="true">
                    <StateIcon state={item.state} />
                  </span>
                  <span className="reunion-visually-hidden">{READINESS_STATE_WORD[item.state]} · </span>
                  <BasisMark basis={item.basis} />
                  {item.label}
                </p>
                <p className="rr-readiness-reason">{item.reason}</p>
                <p className="rr-readiness-fill">{item.howToFill}</p>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    /* CH04 4-1 12개월 지도. 축 라벨에서 '재회'·'연락'을 쓰지 않는다. */
    case 'timeline12': {
      const cells = payload.cells;
      const max = cells.reduce((top, cell) => Math.max(top, cell.score), 0) || 1;
      const active = interactions.activeMonth === null ? null : cells[interactions.activeMonth];
      return (
        <div className="rr-months">
          <p className="rr-months-title">앞으로 12개월 · {name}님의 판단 컨디션</p>
          <ReunionMeterBand
            ns="rr"
            ticks={cells.map((cell, index) => ({
              id: `${cell.year}-${cell.month}`,
              level: cell.score / max,
              state: toBandState(cell.label),
              marked: interactions.activeMonth === index,
              caption: cell.ganzhi,
              srLabel: `${cell.year}년 ${cell.month}월 ${cell.ganzhi} · ${payload.labels[cell.label]}`
            }))}
          />
          <ul className="rr-months-picker" role="list">
            {cells.map((cell, index) => (
              <li key={`${cell.year}-${cell.month}`}>
                <button
                  type="button"
                  className={interactions.activeMonth === index ? 'rr-month is-on' : 'rr-month'}
                  aria-pressed={interactions.activeMonth === index}
                  onClick={() => interactions.onSelectMonth(interactions.activeMonth === index ? null : index)}
                >
                  {cell.month}월
                </button>
              </li>
            ))}
          </ul>
          <p className="rr-months-focus" role="status">
            {active
              ? `${active.year}년 ${active.month}월 · ${payload.labels[active.label]} — ${active.focus}`
              : '달을 누르면 그 달에 볼 것이 여기에 뜹니다.'}
          </p>
        </div>
      );
    }

    /**
     * CH06 6-2 연운. CH04 의 가로 띠와 시각 문법을 일부러 다르게 한다.
     *
     * 노드 문장은 `summary` 가 아니라 `focus` 를 쓴다. 두 가지 이유가 겹친다.
     *   1) `summary` 는 간지 역학 서술이라 십성 용어가 문장 안에 그대로 섞인다.
     *      컷 대사에 명리 용어를 두지 않는 2층 분리 규칙(§3-5)과 어긋나고, 용어 해설은
     *      이 장의 근거 아코디언이 이미 맡고 있다.
     *   2) 이 컷의 캡션은 '{이름}님 쪽 여력이 바뀌는 지점'이라고 말한다. `focus` 가
     *      독자 쪽 행동을 적는 필드이고, `summary` 보다 짧아 CH05 와의 분량 대칭도 지켜진다
     *      — 두 장의 길이 차이 자체가 한쪽을 권유하는 신호가 된다(§1).
     */
    case 'timelineYears':
      return payload.cells.length > 0 ? (
        <ReunionMeterTimeline
          ns="rr"
          orientation="vertical"
          nodes={payload.cells.map((cell) => ({
            id: String(cell.year),
            when: `${cell.year}년`,
            count: payload.labels[cell.label],
            state: toBandState(cell.label),
            note: cell.focus || cell.summary
          }))}
        />
      ) : (
        <p className="rr-empty">앞으로의 연 단위 구간을 그릴 자료가 아직 없어요.</p>
      );

    /* CH04 4-4 판단 기한. 서버는 범위만 제안하고 날짜를 대신 정하지 않는다. */
    case 'deadline-input':
      return (
        <div className="rr-deadline">
          <label className="rr-deadline-line" htmlFor="rr-deadline-input">
            <span>나는</span>
            <input
              id="rr-deadline-input"
              type="date"
              value={interactions.deadline}
              onChange={(event) => interactions.onDeadline(event.target.value)}
            />
            <span>까지 확인하고, 그때 결정하겠습니다.</span>
          </label>
          {/* 입력 전에는 화면의 유일한 날짜가 서버 제안 구간이다.
              그 위에 '{이름}님이 정한 점검일이에요'를 붙이면 서버가 만든 범위를
              독자가 정한 것으로 귀속시키게 되므로, 입력 전에는 이 안내가 대신 나간다. */}
          {interactions.deadline ? null : (
            <p className="rr-deadline-before">{payload.beforeInputNote}</p>
          )}
          {payload.suggestion ? (
            <p className="rr-deadline-suggest">
              <BasisMark basis="calculated" />
              제안 구간 {payload.suggestion.label}
              <span className="rr-deadline-rationale">{payload.suggestion.rationale}</span>
            </p>
          ) : null}
          {interactions.deadline ? (
            <p className="rr-deadline-value">{interactions.deadline.replace(/-/gu, '. ')}</p>
          ) : null}
        </div>
      );

    /* CH07 7-5 판단 기록. CH04 에서 쓴 기한이 이미 채워진 채 나타난다. */
    case 'decision-input':
      return (
        <div className="rr-decision">
          <p className="rr-decision-deadline">
            {interactions.deadline
              ? `정하신 날 · ${interactions.deadline.replace(/-/gu, '. ')}`
              : '아직 날짜를 정하지 않으셨어요. 앞 장으로 돌아가 적어 두셔도 돼요.'}
          </p>
          <label className="rr-decision-line" htmlFor="rr-decision-input">
            <span>나는</span>
            <input
              id="rr-decision-input"
              type="text"
              value={interactions.decision}
              placeholder="한 줄만 적어 두세요"
              onChange={(event) => interactions.onDecision(event.target.value)}
            />
            <span>하기로 했다.</span>
          </label>
          <button type="button" className="rr-save" onClick={interactions.onSaveDecision}>
            이 기기에 저장
          </button>
          <p className="rr-save-note" role="status">
            {interactions.saveNote}
          </p>
        </div>
      );

    case 'checklist':
      return payload.items.length > 0 ? (
        <ul className="rr-checklist" role="list">
          {payload.items.map((item) => {
            const on = Boolean(interactions.checked[item.id]);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={on ? 'rr-check is-on' : 'rr-check'}
                  aria-pressed={on}
                  onClick={() => interactions.onToggle(item.id)}
                >
                  <span className="rr-check-box" aria-hidden="true">
                    {on ? <Check size={13} /> : null}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rr-empty">{payload.emptyLabel || '이 칸에 넣을 항목이 아직 확정되지 않았어요.'}</p>
      );

    /* CH03 3-2 미확인 조건 카드. 캡션이 약속한 `조건 · 지금 상태 · 채우는 방법` 세 줄을
       그대로 그린다. 체크박스로 두지 않는다 — 토글해도 위의 게이지 집계에 반영되지 않는다. */
    case 'condition-cards':
      return payload.items.length > 0 ? (
        <ul className="rr-conditions" role="list">
          {payload.items.map((item) => (
            <li className={`rr-condition is-${item.state}`} key={item.id}>
              <p className="rr-condition-label">
                <span className="rr-readiness-state" aria-hidden="true">
                  <StateIcon state={item.state} />
                </span>
                <span className="reunion-visually-hidden">{READINESS_STATE_WORD[item.state]} · </span>
                <BasisMark basis={item.basis} />
                {item.label}
              </p>
              <p className="rr-condition-reason">{item.reason}</p>
              <p className="rr-condition-fill">{item.howToFill}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rr-empty">{payload.emptyLabel}</p>
      );

    /* 장 제목이 h2 이므로 열 제목은 h3 이다. 레벨을 건너뛰지 않는다. */
    case 'compare2':
      return (
        <div className="rr-compare2">
          {[payload.left, payload.right].map((column) => (
            <section className="rr-compare2-col" key={column.title}>
              <h3>{column.title}</h3>
              <ul role="list">
                {column.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      );

    case 'compare3':
      return (
        <table className="rr-compare3">
          <thead>
            <tr>
              {payload.headers.map((header) => (
                <th scope="col" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, index) => (
                  <td key={cell} className={index === 1 ? 'is-now' : undefined}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );

    /* CH03 3-3 하지 않을 행동. 훈계형이 아니라 계량 서술이고,
       감시 유도를 **금지하기 위해** 항목 이름을 부른다(§6-B 상위 규칙). */
    case 'prohibited':
      return (
        <ul className="rr-prohibited" role="list">
          {payload.items.map((item) => (
            <li key={item}>
              <span className="rr-prohibited-mark" aria-hidden="true">
                <X size={15} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      );

    /* CH07 7-1 닫는 집계. 이 리포트의 유일한 집계 숫자이고 예측이 아니다. */
    case 'tally':
      return (
        <div className="rr-tally-block">
          <ReunionMeterGauge
            ns="rr"
            ariaLabel={`확인 ${payload.confirmed} · 미확인 ${payload.unconfirmed} · 보류 ${payload.deferred}`}
            cells={payload.items.map((item) => ({
              id: item.id,
              state:
                item.state === 'confirmed' ? 'met' : item.state === 'unconfirmed' ? 'unmet' : 'unknown'
            }))}
          />
          <ReunionMeterTally
            ns="rr"
            items={[
              { id: 'confirmed', num: String(payload.confirmed), unit: '개', label: '확인된 질문', state: 'met' },
              {
                id: 'unconfirmed',
                num: String(payload.unconfirmed),
                unit: '개',
                label: '아직 확인 못 한 질문',
                state: 'unmet'
              },
              { id: 'deferred', num: String(payload.deferred), unit: '개', label: '오늘은 보류', state: 'unknown' }
            ]}
          />
          <ol className="rr-checkpoints" role="list">
            {payload.items.map((item) => (
              <li className={`rr-checkpoint is-${item.state}`} key={item.id}>
                <span className="rr-checkpoint-dot" aria-hidden="true" />
                <span className="reunion-visually-hidden">{CHECKPOINT_STATE_WORD[item.state]} · </span>
                <span className="rr-checkpoint-question">{item.question}</span>
                {item.why ? <span className="rr-checkpoint-why">{item.why}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      );

    /* CH07 7-2 미확인 항목. 모르는 걸 모른다고 말하는 이 컷이 신뢰의 최종 근거다. */
    case 'unconfirmed':
      return payload.items.length > 0 ? (
        <ul className="rr-unconfirmed" role="list">
          {payload.items.map((item) => (
            <li key={item.label}>
              <strong>{item.label}</strong>
              <span>{item.why}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rr-empty">여섯 질문 모두 확인 가능한 자료가 있었어요.</p>
      );

    case 'quote':
      return (
        <figure className="rr-quote">
          <blockquote>{payload.text}</blockquote>
          <figcaption>{payload.note}</figcaption>
        </figure>
      );

    case 'letter':
      return (
        <div className="rr-letter">
          {payload.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p className="rr-letter-sign">{payload.signature}</p>
        </div>
      );

    case 'legal':
      return (
        <div className="rr-legal">
          {/* §6-A. 차단·미확인 분기는 CH07 에서 한 번 더 확인한다.
              삭제 불가 법정 고지(`lines`)와 섞지 않고 그 위에 따로 둔다. */}
          {payload.boundaryNote ? <p className="rr-legal-boundary">{payload.boundaryNote}</p> : null}
          <ul role="list">
            {payload.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="rr-legal-serial">
            {payload.serialNumber}
            {payload.issuedAt ? ` · ${payload.issuedAt.slice(0, 10)}` : ''}
          </p>
        </div>
      );

    default:
      return null;
  }
}

/* ── 컷 ──────────────────────────────────────────────────────── */

const SCENE_ALT_FALLBACK = '';

/**
 * 내용이 하나도 없는 컷인가.
 * 장 여는 컷(`c01-1` 등)이 여기에 해당한다 — 그 자리의 챕터 헤더는 `.rr-chapter-head` 가
 * 이미 그리고 있으므로, 같은 내용을 두 번 그리는 대신 명판 선 한 줄로 리듬만 남긴다.
 * 컷을 배열에서 빼지는 않는다(컷 id 는 제미나이 매칭 키이자 테스트가 세는 단위다).
 */
function isPlateCut(cut: ReunionCut): boolean {
  return (
    !cut.payload &&
    !cut.narration &&
    !cut.caption &&
    !cut.sceneKey &&
    cut.bubbles.length === 0 &&
    cut.evidenceBadges.length === 0
  );
}

export default function ReunionCutView({ cut, name, dayunLabel, interactions }: ReunionCutViewProps) {
  /* beat 컷은 높이만 갖는 침묵이다. 안에 아무것도 넣지 않는다. */
  if (cut.layout === 'beat') {
    return (
      <div
        className="rr-cut rr-cut--beat"
        data-cut={cut.id}
        style={{ '--rr-h': `${cut.height}px` } as CSSProperties}
        aria-hidden="true"
      />
    );
  }

  if (isPlateCut(cut)) {
    return (
      <div className="rr-cut rr-cut--plate" data-cut={cut.id} aria-hidden="true">
        <span className="rr-plate-rule" />
      </div>
    );
  }

  const sceneAlt = cut.sceneAlt || SCENE_ALT_FALLBACK;
  /**
   * `deadline-owner`(`{이름}님이 정한 점검일이에요.`)는 §6-F 가 '독자 입력 후에만'으로 못박은
   * 유일한 조건부 삭제 불가 문구다. 날짜를 쓰기 전에는 화면의 유일한 날짜가 서버 제안 구간이라,
   * 그 위에 이 문장을 붙이면 서버가 만든 범위를 독자가 정한 것처럼 귀속시킨다.
   * 대신 `payload.beforeInputNote` 가 입력 자리 안에서 안내를 맡는다.
   */
  const captionHeldForInput =
    cut.payload?.kind === 'deadline-input' && !interactions.deadline;
  const captionLeads = Boolean(cut.caption) && CAPTION_ABOVE.has(cut.payload?.kind ?? '');
  const caption =
    cut.caption && !captionHeldForInput ? (
      <p className={captionLeads ? 'rr-caption is-lead' : 'rr-caption'}>{cut.caption}</p>
    ) : null;

  return (
    <div
      className={`rr-cut rr-cut--${cut.layout}`}
      data-cut={cut.id}
      /* 그림 없는 시네마틱 컷은 순검정 침묵 컷이다. 글을 바닥에 붙이지 않고 가운데 세운다. */
      data-scene={cut.sceneKey ? 'art' : 'none'}
      data-undeletable={cut.undeletableCopyId || undefined}
      style={{ '--rr-h': `${cut.height}px`, '--rr-scale': cut.sceneScale ?? 1 } as CSSProperties}
    >
      {cut.sceneKey ? (
        <figure className="rr-fig" aria-hidden={sceneAlt ? undefined : true}>
          {/* ReunionSceneKey 와 ReunionPanelKey 는 같은 집합이다(reportTypes.contract.test.ts 가 잠근다).
              캐스팅하지 않는 이유: 두 목록이 갈라지면 여기서 타입 오류로 먼저 걸려야 한다. */}
          <ReunionPanelPicture image={cut.sceneKey} className="rr-fig-pic" alt={sceneAlt} />
          <span className="rr-fig-fade" aria-hidden="true" />
        </figure>
      ) : null}

      <div className="rr-cut-body">
        {cut.narration ? <p className="rr-narration">{cut.narration}</p> : null}

        {cut.bubbles.map((bubble) => (
          <p
            className={`rr-bubble is-${bubble.kind} is-${bubble.tone}`}
            data-pos={bubble.position}
            key={bubble.text}
          >
            {bubble.text}
          </p>
        ))}

        {captionLeads ? caption : null}

        <CutPayload cut={cut} name={name} dayunLabel={dayunLabel} interactions={interactions} />

        {captionLeads ? null : caption}

        {cut.evidenceBadges.length > 0 ? (
          <ul className="rr-badges" role="list">
            {cut.evidenceBadges.map((badge) => (
              <li key={badge.term}>
                <span className="rr-badge-term">[{badge.term}]</span>
                <span className="rr-badge-translation">{badge.translation}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
