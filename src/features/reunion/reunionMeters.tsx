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

import type { CSSProperties, ReactNode } from 'react';

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
