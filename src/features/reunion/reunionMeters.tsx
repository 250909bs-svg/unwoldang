/**
 * 재회운 계측 프리미티브 — 게이지 · 띠 · 타임라인 · 집계.
 *
 * 상세페이지(`ReunionLanding.tsx`)와 리포트(`ReunionReportView.tsx`)가 **같은 마크업**을 쓴다.
 * 상세페이지에서는 값이 비어 있고(예시 화면), 리포트에서는 실제 계산값이 들어간다.
 * 두 벌로 만들지 않는다 — 한쪽만 고치면 두 화면의 시각 문법이 조용히 갈라진다.
 *
 * `ns` 는 클래스 접두사다. 상세페이지는 `rw`(reunion-webtoon.css), 리포트는 `rr`(reunion-report.css).
 * **마크업은 공유하고 스킨만 갈라 놓는 것**이 이 파일의 유일한 목적이므로,
 * 여기서 색·여백을 정하지 않는다.
 *
 * 상세페이지 DOM 을 바꾸지 않는 것이 계약이다: 선택 prop 을 비우면
 * 기존 `Mechanic` 이 그리던 것과 **속성 하나까지 같은** 결과가 나와야 한다.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** `rw` = 웹툰 랜딩, `rr` = 리포트. */
export type ReunionMeterNamespace = 'rw' | 'rr';

export type ReunionMeterState = 'met' | 'unmet' | 'unknown' | 'open' | 'normal' | 'hold';

/* ── 게이지 ──────────────────────────────────────────────────── */

export interface ReunionMeterGaugeCell {
  id: string;
  /** 없으면 빈 칸(상세페이지의 '우리가 채우지 않는 칸'). */
  state?: ReunionMeterState;
}

export interface ReunionMeterGaugeProps {
  ns: ReunionMeterNamespace;
  cells: readonly ReunionMeterGaugeCell[];
  /** 칸이 실제 값을 가질 때만 준다. 빈 게이지에 라벨을 붙이면 거짓말이 된다. */
  ariaLabel?: string;
}

export function ReunionMeterGauge({ ns, cells, ariaLabel }: ReunionMeterGaugeProps) {
  return (
    <div className={`${ns}-gauge`} role={ariaLabel ? 'img' : undefined} aria-label={ariaLabel}>
      <div className={`${ns}-gauge-track`}>
        {cells.map((cell) => (
          <span
            className={cell.state ? `${ns}-gauge-cell is-${cell.state}` : `${ns}-gauge-cell`}
            aria-hidden="true"
            key={cell.id}
          />
        ))}
      </div>
    </div>
  );
}

/* ── 띠(가로 12칸) ───────────────────────────────────────────── */

export interface ReunionMeterBandTick {
  id: string;
  marked?: boolean;
  state?: ReunionMeterState;
  /** 0~1. 막대 높이로 그린다. 없으면 고정 높이 눈금이다. */
  level?: number;
  /** 칸 안에 찍히는 짧은 글자(간지 2자). */
  caption?: string;
  /** 스크린리더용 한 줄. 눈금이 aria-hidden 이 아닐 때만 쓴다. */
  srLabel?: string;
}

export interface ReunionMeterBandProps {
  ns: ReunionMeterNamespace;
  ticks: readonly ReunionMeterBandTick[];
  /** 눈금이 장식일 때 true. 상세페이지의 빈 띠가 이 경우다. */
  ticksHidden?: boolean;
  label?: string;
  /** 라벨이 마스킹된 자리표시자일 때 true. */
  labelHidden?: boolean;
  /** 마스킹된 라벨을 대신 읽어 줄 문장. */
  srText?: string;
  note?: string;
}

export function ReunionMeterBand({
  ns,
  ticks,
  ticksHidden,
  label,
  labelHidden,
  srText,
  note
}: ReunionMeterBandProps) {
  return (
    <div className={`${ns}-band`}>
      {/* 두 시트 모두 리스트에 `list-style: none` 을 건다. Safari/VoiceOver 는 그 경우
          목록 시맨틱을 제거하므로 역할을 다시 붙인다(이 파일의 다른 리스트와 같은 규칙). */}
      <ol className={`${ns}-band-ticks`} role="list" aria-hidden={ticksHidden ? true : undefined}>
        {ticks.map((tick) => (
          <li
            className={[
              `${ns}-band-tick`,
              tick.marked ? 'is-marked' : '',
              tick.state ? `is-${tick.state}` : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              typeof tick.level === 'number'
                ? ({ '--meter-level': `${Math.round(tick.level * 100)}%` } as CSSProperties)
                : undefined
            }
            key={tick.id}
          >
            {tick.caption ? (
              <span className={`${ns}-band-tick-caption`} aria-hidden="true">
                {tick.caption}
              </span>
            ) : null}
            {tick.srLabel ? <span className="reunion-visually-hidden">{tick.srLabel}</span> : null}
          </li>
        ))}
      </ol>
      {label ? (
        <p className={`${ns}-band-label`} aria-hidden={labelHidden ? true : undefined}>
          {label}
        </p>
      ) : null}
      {srText ? <span className="reunion-visually-hidden">{srText}</span> : null}
      {note ? <p className={`${ns}-band-note`}>{note}</p> : null}
    </div>
  );
}

/* ── 타임라인 ────────────────────────────────────────────────── */

export interface ReunionMeterTimelineNode {
  id: string;
  when: string;
  count: string;
  state?: ReunionMeterState;
  note?: string;
}

export interface ReunionMeterTimelineProps {
  ns: ReunionMeterNamespace;
  nodes: readonly ReunionMeterTimelineNode[];
  /** 세로 타임라인은 리포트 CH06 전용이다. CH04 의 가로 띠와 일부러 다르게 그린다. */
  orientation?: 'vertical';
}

export function ReunionMeterTimeline({ ns, nodes, orientation }: ReunionMeterTimelineProps) {
  return (
    <ol className={`${ns}-timeline`} role="list" data-orientation={orientation}>
      {nodes.map((node) => (
        <li
          className={node.state ? `${ns}-timeline-node is-${node.state}` : `${ns}-timeline-node`}
          key={node.id}
        >
          <span className={`${ns}-timeline-dot`} aria-hidden="true" />
          <strong className={`${ns}-timeline-when`}>{node.when}</strong>
          <span className={`${ns}-timeline-count`}>{node.count}</span>
          {node.note ? <span className={`${ns}-timeline-note`}>{node.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/* ── 집계 ────────────────────────────────────────────────────── */

export interface ReunionMeterTallyItem {
  id: string;
  num: string;
  unit: string;
  label: string;
  state?: ReunionMeterState;
}

export interface ReunionMeterTallyProps {
  ns: ReunionMeterNamespace;
  items: readonly ReunionMeterTallyItem[];
  foot?: ReactNode;
}

export function ReunionMeterTally({ ns, items, foot }: ReunionMeterTallyProps) {
  return (
    <>
      <ul className={`${ns}-tally`} role="list">
        {items.map((item) => (
          <li className={item.state ? `${ns}-tally-item is-${item.state}` : undefined} key={item.id}>
            <strong className={`${ns}-tally-num`}>{item.num}</strong>
            <span className={`${ns}-tally-unit`}>{item.unit}</span>
            <span className={`${ns}-tally-label`}>{item.label}</span>
          </li>
        ))}
      </ul>
      {foot ? <p className={`${ns}-tally-foot`}>{foot}</p> : null}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   프리미엄 확장 — 헤드라인 게이지 · 수위 계측 · 원국표 · 점수 행
   ══════════════════════════════════════════════════════════════════════════

   왜 여기에 붙이나
   ----------------
   위 네 프리미티브(게이지 · 띠 · 타임라인 · 집계)와 같은 이유다: 상세페이지와
   리포트가 **같은 마크업**을 써야 두 화면의 시각 문법이 조용히 갈라지지 않는다.
   중복 구현하지 말고 이 파일을 확장한다.

   사실 정합성 계약 (이 파일이 구조적으로 보장한다)
   -----------------------------------------------
   값이 있는 화면과 없는 화면을 `ReunionMeterReading` 하나로 갈라 놓는다.
     - `{ kind: 'value' }`  계산된 값. 리포트에서만.
     - `{ kind: 'sample' }` 상세페이지. **숫자를 그리지 않고** note 를 함께 그린다
                            (예: '리포트에서는 이렇게 보여드립니다').
     - `{ kind: 'hold' }`   CH00 판단 보류. 숫자 없이 보류 문구만.
   `kind !== 'value'` 인데 숫자를 그리는 경로가 이 파일에 없다. 그래서 계산되지
   않은 수치가 사실처럼 보이는 일이 마크업 층에서 원천 차단된다.

   스킨 분담
   ---------
   기하(좌표 · viewBox · 클립 구조)와 공용 스킨은 `reunion-premium.css` 의
   `ud-` 유틸리티가 소유한다. 화면별 미세 조정은 `${ns}-` 클래스가 소유한다.
   두 계열을 같은 요소에 함께 붙인다. */

/** 오행. `reunion-premium.css` 의 `--ud-well-*` / `--ud-el-*` 키와 같은 이름이다. */
export type ReunionElement = 'wood' | 'fire' | 'earth' | 'metal' | 'water';

/**
 * 계측값의 세 상태. 이 유니온이 '계산되지 않은 수치를 사실처럼 보여주지 않는다'는
 * 규격을 타입으로 강제한다.
 */
export type ReunionMeterReading =
  | { kind: 'value'; value: number; ariaLabel: string }
  | { kind: 'sample'; note: string }
  | { kind: 'hold'; note: string };

const readingValue = (reading: ReunionMeterReading) =>
  reading.kind === 'value' ? reading.value : null;

const readingNote = (reading: ReunionMeterReading) =>
  reading.kind === 'value' ? null : reading.note;

/* ── 반원 호 게이지 ──────────────────────────────────────────────────
   좌표는 고정이다: viewBox 285×158.5, 중심 (142.5, 142.5),
   트랙 r=122.88 / 진행 r=121.88(1px 안으로), stroke-width 7.24.
   진행 호는 전체 반원을 그린 뒤 dashoffset 으로 잘라 낸다 — 그래야 값 표현과
   '그려지는' 모션이 같은 한 속성으로 처리되고, 레이아웃을 건드리지 않는다. */

const ARC_R_TRACK = 122.88;
const ARC_R_FILL = 121.88;
/** 반원 호 길이 = π · r. dasharray / dashoffset 의 단위다. */
const ARC_LENGTH = Math.PI * ARC_R_FILL;

const semicircle = (r: number) =>
  `M ${(142.5 - r).toFixed(2)} 142.5 A ${r} ${r} 0 0 1 ${(142.5 + r).toFixed(2)} 142.5`;

/** 0~100 을 벗어난 값이 호를 반대로 돌지 않게 자른다. */
const clampScore = (value: number) => Math.max(0, Math.min(100, value));

export interface ReunionMeterArcProps {
  ns: ReunionMeterNamespace;
  reading: ReunionMeterReading;
  /** 값 아래 단위(예: '점'). `kind: 'value'` 일 때만 그린다. */
  unit?: string;
  /** 계산 근거가 있는 분류 배지(예: '조건 8/13 충족'). 확률 단정 표현은 쓰지 않는다. */
  badge?: string;
  /** 이름 붙인 판정 한 줄. */
  verdict?: string;
  /** 판정 아래 3~4줄 설명. */
  verdictNote?: ReactNode;
  /** 숫자 카운트업 결과를 바깥에서 주입할 때 쓴다(`useReunionCountUp`). */
  display?: number;
}

export function ReunionMeterArc({
  ns,
  reading,
  unit,
  badge,
  verdict,
  verdictNote,
  display
}: ReunionMeterArcProps) {
  const value = readingValue(reading);
  const score = value === null ? 0 : clampScore(value);
  const note = readingNote(reading);
  const shown = display === undefined ? score : clampScore(display);

  return (
    <div
      className={`${ns}-arc ud-arc`}
      data-reading={reading.kind}
      role={reading.kind === 'value' ? 'img' : undefined}
      aria-label={reading.kind === 'value' ? reading.ariaLabel : undefined}
      style={
        {
          '--ud-arc-len': ARC_LENGTH.toFixed(2),
          '--ud-arc-rest': (ARC_LENGTH * (1 - score / 100)).toFixed(2)
        } as CSSProperties
      }
    >
      <svg className="ud-arc-svg" viewBox="0 0 285 158.5" aria-hidden="true">
        <path
          className="ud-arc-track"
          d={semicircle(ARC_R_TRACK)}
          fill="none"
          strokeWidth="7.24"
          strokeLinecap="round"
        />
        {reading.kind === 'value' ? (
          <path
            className="ud-arc-progress"
            d={semicircle(ARC_R_FILL)}
            fill="none"
            strokeWidth="7.24"
            strokeLinecap="round"
          />
        ) : null}
      </svg>

      <div className="ud-arc-readout">
        {badge && reading.kind === 'value' ? (
          <span className={`${ns}-arc-badge ud-arc-badge ud-num`}>{badge}</span>
        ) : null}
        {reading.kind === 'value' ? (
          <p className="ud-arc-value ud-num">
            <strong>{Math.round(shown)}</strong>
            {unit ? <span className="ud-arc-unit">{unit}</span> : null}
          </p>
        ) : null}
        {verdict && reading.kind === 'value' ? (
          <p className={`${ns}-arc-verdict ud-arc-verdict`}>{verdict}</p>
        ) : null}
        {note ? <p className={`${ns}-sample-note ud-sample-note`}>{note}</p> : null}
        {verdictNote ? <div className="ud-arc-note ud-body">{verdictNote}</div> : null}
      </div>
    </div>
  );
}

/* ── 수위 계측 (모양 안에 물이 차오른다) ────────────────────────────
   막대가 아니다. 같은 도형을 두 장 겹치고, 아래 장을 클립 창으로 올린다.
   `.ud-fill` 이 그 창이고 height 를 애니메이션하지 않는다(레이아웃 유발). */

export type ReunionVesselShape = 'hex' | 'lantern' | 'seal';

/** viewBox 0 0 120 108 공용. 세 도형 다 좌우 대칭이다. */
const VESSEL_PATHS: Record<ReunionVesselShape, string> = {
  hex: 'M60 3 L114 29 V79 L60 105 L6 79 V29 Z',
  lantern: 'M30 6 H90 L100 34 Q100 86 60 102 Q20 86 20 34 Z',
  seal: 'M18 6 H102 L114 18 V90 L102 102 H18 L6 90 V18 Z'
};

export interface ReunionMeterVesselProps {
  ns: ReunionMeterNamespace;
  reading: ReunionMeterReading;
  shape?: ReunionVesselShape;
  /** 도형 안에 찍히는 글자 1~2자(한자 또는 한글). */
  glyph?: string;
  /** 항목 이름. 도형 밖에 그린다. */
  label: string;
  /** 계산된 등급 이름. 값이 있을 때만 그린다. */
  grade?: string;
  /** 오행 색을 쓸 때. */
  element?: ReunionElement;
}

export function ReunionMeterVessel({
  ns,
  reading,
  shape = 'hex',
  glyph,
  label,
  grade,
  element
}: ReunionMeterVesselProps) {
  const value = readingValue(reading);
  const level = value === null ? 0 : clampScore(value);
  const note = readingNote(reading);
  const d = VESSEL_PATHS[shape];

  return (
    <div
      className={`${ns}-vessel ud-vessel`}
      data-reading={reading.kind}
      data-el={element}
      role={reading.kind === 'value' ? 'img' : undefined}
      aria-label={reading.kind === 'value' ? reading.ariaLabel : undefined}
      style={{ '--ud-level': `${level}%`, '--ud-factor': level / 100 } as CSSProperties}
    >
      <div className="ud-vessel-art">
        {/* 빈 장 — 언제나 그린다. */}
        <svg className="ud-vessel-empty" viewBox="0 0 120 108" aria-hidden="true">
          <path d={d} fill="none" strokeWidth="5" />
          {glyph ? (
            <text className="ud-vessel-glyph" x="60" y="62" textAnchor="middle">
              {glyph}
            </text>
          ) : null}
        </svg>

        {/* 채운 장 — 값이 있을 때만. 클립 창 안에서 같은 도형을 반복한다. */}
        {reading.kind === 'value' ? (
          <div className="ud-fill ud-vessel-fill">
            <svg viewBox="0 0 120 108" aria-hidden="true">
              <path d={d} strokeWidth="5" />
              {glyph ? (
                <text className="ud-vessel-glyph" x="60" y="62" textAnchor="middle">
                  {glyph}
                </text>
              ) : null}
            </svg>
          </div>
        ) : null}
      </div>

      <p className={`${ns}-vessel-label ud-label`}>{label}</p>
      {/* 도형만으로는 값을 읽을 수 없다. 숫자를 반드시 병기한다. */}
      {reading.kind === 'value' ? (
        <p className="ud-vessel-score ud-num">{Math.round(level)}</p>
      ) : null}
      {grade && reading.kind === 'value' ? (
        <span className={`${ns}-vessel-grade ud-vessel-grade`}>{grade}</span>
      ) : null}
      {note ? <p className={`${ns}-sample-note ud-sample-note`}>{note}</p> : null}
    </div>
  );
}

/* ── 막대 점수 행 (수위 계측이 무거운 자리에서 쓴다) ────────────────
   트랙은 리세스, 막대는 transform: scaleX 로 자란다. width 를 쓰지 않는다. */

export interface ReunionMeterScoreRowProps {
  ns: ReunionMeterNamespace;
  reading: ReunionMeterReading;
  label: string;
  /** 용어를 제자리에서 설명하는 (i) 버튼의 내용. */
  hint?: ReactNode;
  element?: ReunionElement;
}

export function ReunionMeterScoreRow({
  ns,
  reading,
  label,
  hint,
  element
}: ReunionMeterScoreRowProps) {
  const value = readingValue(reading);
  const level = value === null ? 0 : clampScore(value);
  const note = readingNote(reading);

  return (
    <div
      className={`${ns}-scorerow ud-scorerow`}
      data-reading={reading.kind}
      data-el={element}
      style={{ '--ud-level': `${level}%`, '--ud-factor': level / 100 } as CSSProperties}
    >
      <p className={`${ns}-scorerow-label ud-label`}>{label}</p>
      <div
        className="ud-scorerow-track ud-well"
        data-el={element}
        role={reading.kind === 'value' ? 'img' : undefined}
        aria-label={reading.kind === 'value' ? reading.ariaLabel : undefined}
      >
        {reading.kind === 'value' ? <span className="ud-scorerow-bar" aria-hidden="true" /> : null}
      </div>
      {reading.kind === 'value' ? (
        <p className="ud-scorerow-value ud-num">{Math.round(level)}</p>
      ) : null}
      {hint ? <div className="ud-scorerow-hint ud-caption">{hint}</div> : null}
      {note ? <p className={`${ns}-sample-note ud-sample-note`}>{note}</p> : null}
    </div>
  );
}

/* ── 헤드라인 블록 ───────────────────────────────────────────────────
   스크롤 3초 안에 '내 결과'가 잡히는 자리. 지금 리포트에는 이 자리가 없고
   게이지 13칸 · 집계 · 12개월 띠가 전부 상태의 나열이다.
   기존 계측은 이 블록 아래 '근거' 층으로 내려보낸다. */

export interface ReunionMeterHeadlineProps {
  ns: ReunionMeterNamespace;
  /** 작은 주어 줄(예: '{이름}님의'). */
  eyebrow?: string;
  /** 큰 술어 줄(예: '다음 한 걸음'). */
  title: string;
  reading: ReunionMeterReading;
  unit?: string;
  badge?: string;
  verdict?: string;
  verdictNote?: ReactNode;
  display?: number;
  /** 헤드라인 아래에 붙일 근거 층. */
  children?: ReactNode;
}

export function ReunionMeterHeadline({
  ns,
  eyebrow,
  title,
  reading,
  unit,
  badge,
  verdict,
  verdictNote,
  display,
  children
}: ReunionMeterHeadlineProps) {
  return (
    <section className={`${ns}-headline ud-headline`} data-reading={reading.kind}>
      <header className="ud-cardhead">
        {eyebrow ? <small>{eyebrow}</small> : null}
        <strong>{title}</strong>
      </header>
      <ReunionMeterArc
        ns={ns}
        reading={reading}
        unit={unit}
        badge={badge}
        verdict={verdict}
        verdictNote={verdictNote}
        display={display}
      />
      {children ? <div className="ud-headline-basis">{children}</div> : null}
    </section>
  );
}

/* ── 원국표 ──────────────────────────────────────────────────────────
   5열 CSS grid. 1열은 행 라벨, 2~5열은 주(柱)다. 한자는 **텍스트로 유지한다** —
   래스터로 굽는 방식은 선택 불가 · 확대 시 깨짐 · 다크 대응 불가다.
   셀 높이는 고정하지 않고 패딩으로만 잡는다. 320px 오버플로가 나지 않는 이유다. */

export interface ReunionMeterPillarColumn {
  id: string;
  /** 열 머리(예: 시주 · 일주 · 월주 · 년주). */
  head: string;
}

export interface ReunionMeterPillarCell {
  id: string;
  /** 큰 글자 1자. 없으면 빈 칸이다. */
  glyph?: string;
  /** 큰 글자 옆 병기(한글 또는 오행 1자). 글자 크기의 0.4em 으로 우하단에 붙는다. */
  gloss?: string;
  /** 오행 웰 색을 결정한다. */
  element?: ReunionElement;
  /** 글리프 대신 여러 글자를 넣는 칸(십성 · 지장간). */
  text?: string;
}

export interface ReunionMeterPillarRow {
  id: string;
  label: string;
  /** 행 라벨 아래 작은 병기(예: 十干 · 十二支). */
  labelGloss?: string;
  /** `glyph` 는 오행 웰 + 대형 글자, `text` 는 평범한 자료 셀이다. */
  variant?: 'glyph' | 'text';
  cells: readonly ReunionMeterPillarCell[];
}

export interface ReunionMeterPillarsProps {
  ns: ReunionMeterNamespace;
  columns: readonly ReunionMeterPillarColumn[];
  rows: readonly ReunionMeterPillarRow[];
  reading: ReunionMeterReading;
  /** 표 위에 놓는 2줄 헤드라인. */
  caption?: ReactNode;
}

export function ReunionMeterPillars({
  ns,
  columns,
  rows,
  reading,
  caption
}: ReunionMeterPillarsProps) {
  const note = readingNote(reading);
  const filled = reading.kind === 'value';

  return (
    <div className={`${ns}-pillars ud-pillars`} data-reading={reading.kind}>
      {caption ? <div className="ud-pillars-caption">{caption}</div> : null}

      <div
        className="ud-pillars-grid"
        role="table"
        aria-label={filled ? reading.ariaLabel : undefined}
      >
        <div className="ud-pillars-row ud-pillars-row--head" role="row">
          <span className="ud-pillars-label" role="columnheader" />
          {columns.map((column) => (
            <span className="ud-pillars-head ud-label" role="columnheader" key={column.id}>
              {column.head}
            </span>
          ))}
        </div>

        {rows.map((row) => (
          <div
            className="ud-pillars-row"
            data-variant={row.variant ?? 'text'}
            role="row"
            key={row.id}
          >
            <span className="ud-pillars-label" role="rowheader">
              {row.label}
              {row.labelGloss ? <small className="ud-gloss">{row.labelGloss}</small> : null}
            </span>
            {row.cells.map((cell) =>
              row.variant === 'glyph' ? (
                <span
                  className="ud-pillars-cell ud-well"
                  data-el={cell.element}
                  role="cell"
                  key={cell.id}
                >
                  {cell.glyph ? (
                    <span className="ud-pillars-glyph ud-hanja">
                      {cell.glyph}
                      {cell.gloss ? <i className="ud-gloss">{cell.gloss}</i> : null}
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className="ud-pillars-cell ud-pillars-cell--text" role="cell" key={cell.id}>
                  {cell.text ?? cell.glyph ?? ''}
                </span>
              )
            )}
          </div>
        ))}
      </div>

      {note ? <p className={`${ns}-sample-note ud-sample-note`}>{note}</p> : null}
    </div>
  );
}

/* ── 숫자 카운트업 ───────────────────────────────────────────────────
   CSS 로는 셀 수 없으므로 여기만 JS 다. 규칙 두 개:
     1) 감속 선호에서는 즉시 최종값으로 앉힌다(애니메이션을 시작하지 않는다).
     2) 표시 요소에 `tabular-nums` 와 고정폭이 있어야 한다. 없으면 숫자가
        돌 때 폭이 변해 레이아웃이 떨린다 — `.ud-num` 유틸리티가 그것을 준다.
   `target` 이 null 이면(= 값이 없는 화면) 아무것도 세지 않고 null 을 돌려준다. */

export interface ReunionCountUpOptions {
  durationMs?: number;
  /** false 면 최종값에 그대로 앉는다(리빌 전에는 세지 않게 하고 싶을 때). */
  active?: boolean;
}

export function useReunionCountUp(
  target: number | null,
  { durationMs = 1200, active = true }: ReunionCountUpOptions = {}
): number | null {
  const [shown, setShown] = useState<number | null>(target);
  const frame = useRef(0);

  useEffect(() => {
    if (target === null) {
      setShown(null);
      return;
    }

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!active || reduced || typeof window === 'undefined' || !window.requestAnimationFrame) {
      setShown(target);
      return;
    }

    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / durationMs);
      /* --ud-ease-out 과 같은 감속 감각. 1 - (1-t)^3. */
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(target * eased);
      if (t < 1) frame.current = window.requestAnimationFrame(step);
    };

    setShown(0);
    frame.current = window.requestAnimationFrame(step);

    return () => window.cancelAnimationFrame(frame.current);
  }, [target, durationMs, active]);

  return shown;
}
