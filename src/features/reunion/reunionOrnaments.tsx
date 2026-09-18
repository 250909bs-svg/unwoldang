/**
 * 운월당 재회운 장식 SVG 라이브러리 — 상세 · 입력 · 리포트 세 화면 공용.
 *
 * 왜 이 파일이 있나
 * -----------------
 * `ReunionLanding.tsx` 의 인라인 SVG 는 4개뿐이고 viewBox 가 전부 46px 이하다.
 * 발주자 아트(5.png / 4.png)는 장식 계열이 10종 이상이고 코너 로제트만 60px 다.
 * 밀도 차이가 "밤티" 의 큰 축이므로 재사용 가능한 컴포넌트로 한 번에 세운다.
 *
 * 규칙
 * ----
 * 1. **색을 여기서 정하지 않는다.** 전부 `currentColor` 또는
 *    `reunion-premium.css` 의 `--ud-*` 토큰을 읽는다. 세 화면이 같은 장식을
 *    자기 면 색에 맞춰 쓰기 위해서다.
 * 2. 장식은 전부 `aria-hidden="true" focusable="false"` 다. 뜻을 나르는 글자는
 *    장식 옆의 실제 텍스트가 나른다.
 * 3. SVG `<defs>` 의 id 는 `UdOrnamentDefs` 하나에 모아 둔다. 카드마다 같은 id 로
 *    defs 를 복제하면 중복 id 가 되고, 지금 동작하는 것은 우연이다.
 * 4. path 는 전부 새로 그렸다. 참고 자료(청월당 · 타이트사주)의 path 문자열과
 *    색 조합은 한 개도 가져오지 않았다.
 * 5. 모션은 CSS 가 소유한다. 여기서는 `.ud-draw` 같은 클래스를 받을 수 있도록
 *    `className` 만 열어 둔다.
 */

import type { CSSProperties, ReactNode } from 'react';

/* ══════════════════════════════════════════════════════════════════════════
   공통 타입
   ══════════════════════════════════════════════════════════════════════════ */

export type UdCorner = 'tl' | 'tr' | 'bl' | 'br';

export interface UdOrnamentProps {
  className?: string;
  style?: CSSProperties;
  /** 한 변의 픽셀 크기. 기본값은 컴포넌트마다 다르다. */
  size?: number;
}

const CORNER_TRANSFORM: Record<UdCorner, string> = {
  tl: 'none',
  tr: 'scaleX(-1)',
  bl: 'scaleY(-1)',
  br: 'scale(-1)'
};

const decorative = {
  'aria-hidden': true,
  focusable: 'false'
} as const;

/* ══════════════════════════════════════════════════════════════════════════
   0. 문서 단위 defs — 페이지당 **한 번만** 렌더한다.
   ══════════════════════════════════════════════════════════════════════════
   `filter: url(#ud-deckle)` 를 CSS 에서 부르려면 id 가 고정되어야 하므로
   이 컴포넌트는 싱글턴이다. 페이지 루트 바로 안에 한 번 놓아라.
   deckle 필터는 매끈한 도형을 손으로 찢은 먹지 테두리로 바꾼다. 컴포지팅 비용이
   있으므로 **회당 1~2곳**(장 헤더 명판 · 안전 패널)에만 걸어라. */

export function UdOrnamentDefs() {
  return (
    <svg className="ud-defs" width="0" height="0" {...decorative}>
      <defs>
        {/* 금속 램프. 좌상단이 밝고 우하단이 어두워야 금속으로 읽힌다. */}
        <linearGradient id="ud-grad-metal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--ud-metal-0)" />
          <stop offset="24%" stopColor="var(--ud-metal-2)" />
          <stop offset="56%" stopColor="var(--ud-metal-4)" />
          <stop offset="82%" stopColor="var(--ud-metal-6)" />
          <stop offset="100%" stopColor="var(--ud-metal-8)" />
        </linearGradient>

        {/* 뇌문 디바이더용.
            이전 판은 세로(위=진홍 → 아래=청동)였다. 뇌문의 세로 획이 전부
            그라디언트 윗부분에 걸려서, 금속으로 의도한 장치가 실제로는
            **채도 높은 붉은 블록 문자열**로 렌더됐다(제품 13곳에서 반복).
            가로로 돌리고 진홍을 양 끝단으로 밀어낸다 — 본체는 금속 램프이고
            붉은 기는 레일 끝에서만 스민다. */}
        <linearGradient id="ud-grad-fret" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--ud-crimson-deep)" />
          <stop offset="9%" stopColor="var(--ud-metal-6)" />
          <stop offset="34%" stopColor="var(--ud-metal-3)" />
          <stop offset="50%" stopColor="var(--ud-metal-1)" />
          <stop offset="66%" stopColor="var(--ud-metal-3)" />
          <stop offset="91%" stopColor="var(--ud-metal-6)" />
          <stop offset="100%" stopColor="var(--ud-crimson-deep)" />
        </linearGradient>

        {/* 제목 글리프용 세로 금박. */}
        <linearGradient id="ud-grad-gilt" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fffdf8" />
          <stop offset="44%" stopColor="var(--ud-cream)" />
          <stop offset="100%" stopColor="var(--ud-metal-3)" />
        </linearGradient>

        {/* 등불 글로우. */}
        <radialGradient id="ud-grad-bloom" cx="50%" cy="46%" r="52%">
          <stop offset="0%" stopColor="var(--ud-crimson)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--ud-crimson)" stopOpacity="0" />
        </radialGradient>

        {/* 먹지 테두리. scale 은 18~24 사이로 둔다. 100 은 시안의 정연한 금테와 다르다.
            블리드는 24px 이하여야 375px 에서 가로 오버플로가 생기지 않는다. */}
        <filter
          id="ud-deckle"
          x="-8%"
          y="-8%"
          width="116%"
          height="116%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.026"
            numOctaves="3"
            seed="1928"
            result="ud-noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="ud-noise"
            scale="20"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   1. 뇌문 코너 프렛워크 — 가성비가 가장 좋은 장식.
   ══════════════════════════════════════════════════════════════════════════
   곡선이 0개다. path 를 M / H / V 명령만으로 쓴다. 4방향은 transform 재사용. */

export interface UdFretProps extends UdOrnamentProps {
  corner?: UdCorner;
}

export function UdFret({ corner = 'tl', size = 28, className, style }: UdFretProps) {
  return (
    <svg
      className={className}
      style={{ transform: CORNER_TRANSFORM[corner], ...style }}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="butt"
      {...decorative}
    >
      <path d="M1 1 H23 M1 1 V23" />
      <path d="M5 5 H19 M5 5 V15 M5 15 H13 M13 15 V9 M13 9 H9 M9 9 V12" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   2. 8각 컴패스 로제트 — 금테 밴드 위에 걸터앉는 코너 문양.
   ══════════════════════════════════════════════════════════════════════════ */

export function UdRosette({ size = 34, className, style }: UdOrnamentProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      {...decorative}
    >
      {/* 8침. 긴 침 4개 + 짧은 침 4개. */}
      <path
        d="M20 2 L22 18 L20 20 L18 18 Z M38 20 L22 22 L20 20 L22 18 Z M20 38 L18 22 L20 20 L22 22 Z M2 20 L18 18 L20 20 L18 22 Z"
        fill="url(#ud-grad-metal)"
      />
      <path
        d="M31.3 8.7 L22.4 17.6 L20 20 L22.4 22.4 Z M31.3 31.3 L22.4 22.4 L20 20 L17.6 22.4 Z M8.7 31.3 L17.6 22.4 L20 20 L17.6 17.6 Z M8.7 8.7 L17.6 17.6 L20 20 L22.4 17.6 Z"
        fill="currentColor"
        opacity="0.55"
      />
      <circle cx="20" cy="20" r="6.2" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="20" cy="20" r="2.4" fill="url(#ud-grad-metal)" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   3. 필리그리 스팬드럴 — 두 선 사이를 채우는 덩굴 컬.
   ══════════════════════════════════════════════════════════════════════════
   내부 헤어라인의 종단은 연꽃 스크롤 볼류트로 끝난다. */

export interface UdSpandrelProps extends UdOrnamentProps {
  corner?: UdCorner;
}

export function UdSpandrel({ corner = 'tl', size = 26, className, style }: UdSpandrelProps) {
  return (
    <svg
      className={className}
      style={{ transform: CORNER_TRANSFORM[corner], ...style }}
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      strokeLinecap="round"
      opacity="0.72"
      {...decorative}
    >
      <path d="M1 14 q0 -13 13 -13" />
      <path d="M4 14 q0 -10 10 -10 q-6 2 -6 6 q0 3 3 3 q2 0 2 -2 q0 -1.4 -1.4 -1.4" />
      <path d="M14 7 q4 0 6 -3" />
      <circle cx="9.6" cy="9.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   4. 코너 세트 — 프레임 네 귀에 같은 장식을 한 번에 놓는다.
   ══════════════════════════════════════════════════════════════════════════
   z-0 에 깔고 콘텐츠를 그 위에 두는 순서는 `.ud-frame` 이 이미 보장한다. */

export type UdCornerKind = 'fret' | 'rosette' | 'spandrel';

export interface UdCornersProps {
  kind?: UdCornerKind;
  size?: number;
  /** 프레임 모서리에서 안쪽으로 들어가는 거리. 기본 6px. */
  inset?: number;
  className?: string;
}

const CORNERS: readonly UdCorner[] = ['tl', 'tr', 'bl', 'br'];

export function UdCorners({ kind = 'fret', size, inset = 6, className }: UdCornersProps) {
  return (
    <span className={className ? `ud-corners ${className}` : 'ud-corners'} aria-hidden="true">
      {CORNERS.map((corner) => {
        const position: CSSProperties = {
          position: 'absolute',
          top: corner === 'tl' || corner === 'tr' ? inset : undefined,
          bottom: corner === 'bl' || corner === 'br' ? inset : undefined,
          left: corner === 'tl' || corner === 'bl' ? inset : undefined,
          right: corner === 'tr' || corner === 'br' ? inset : undefined
        };

        if (kind === 'rosette') {
          /* 로제트는 대칭이므로 회전하지 않는다. */
          return <UdRosette key={corner} size={size ?? 30} style={position} />;
        }
        if (kind === 'spandrel') {
          return <UdSpandrel key={corner} corner={corner} size={size ?? 24} style={position} />;
        }
        return <UdFret key={corner} corner={corner} size={size ?? 26} style={position} />;
      })}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   5. 금테 액자 래퍼 — `.ud-frame` + 코너 장식을 한 컴포넌트로.
   ══════════════════════════════════════════════════════════════════════════ */

export interface UdFrameBoxProps {
  children: ReactNode;
  /** `gilt` 은 그라디언트 금테(무게 있는 자료 블록), `rule` 은 단선 외곽. */
  tone?: 'gilt' | 'rule';
  corner?: UdCornerKind | 'none';
  /** 금테 두께. gilt 에서만 쓴다. 기본 2px. */
  weight?: number;
  className?: string;
  style?: CSSProperties;
}

export function UdFrameBox({
  children,
  tone = 'gilt',
  corner = 'rosette',
  weight,
  className,
  style
}: UdFrameBoxProps) {
  const classes = ['ud-frame', tone === 'gilt' ? 'ud-frame--gilt' : '', className]
    .filter(Boolean)
    .join(' ');

  const vars = weight ? ({ '--ud-frame-w': `${weight}px`, ...style } as CSSProperties) : style;

  return (
    <div className={classes} style={vars}>
      {corner === 'none' ? null : <UdCorners kind={corner} />}
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   6. 현판 (open plaque) — 상단 룰이 양 끝에서 사분원으로 꺾여 내려간다.
   ══════════════════════════════════════════════════════════════════════════
   끝은 3점 다이아몬드 클러스터로 종결한다. 닫힌 사각형이 아니라 '열린' 액자다. */

export interface UdPlaqueProps {
  children: ReactNode;
  className?: string;
}

export function UdPlaque({ children, className }: UdPlaqueProps) {
  return (
    <div className={className ? `ud-plaque ${className}` : 'ud-plaque'}>
      <svg
        className="ud-plaque-rule"
        viewBox="0 0 320 56"
        preserveAspectRatio="none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        {...decorative}
      >
        <path d="M2 54 V18 q0 -12 12 -12 H140" vectorEffect="non-scaling-stroke" />
        <path d="M318 54 V18 q0 -12 -12 -12 H180" vectorEffect="non-scaling-stroke" />
        {/* 상단 룰 중앙의 브레이크 마커. */}
        <path d="M150 6 L160 1 L170 6" vectorEffect="non-scaling-stroke" />
        {/* 3점 다이아몬드 종단. */}
        <rect
          x="0.4"
          y="52"
          width="3.2"
          height="3.2"
          transform="rotate(45 2 53.6)"
          fill="currentColor"
          stroke="none"
        />
        <rect
          x="316.4"
          y="52"
          width="3.2"
          height="3.2"
          transform="rotate(45 318 53.6)"
          fill="currentColor"
          stroke="none"
        />
      </svg>
      <div className="ud-plaque-body">{children}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   7. 카르투슈 / CTA — 라운드가 아니라 오목 브래킷 + 45도 챔퍼.
   ══════════════════════════════════════════════════════════════════════════
   path 하나를 두 번 그린다(외곽 얇은 선 + 실제 엣지). `drawable` 이면
   `.ud-draw` 가 붙어 선이 그려지는 리빌이 공짜로 붙는다. */

export interface UdCartoucheProps {
  children: ReactNode;
  /** `cta` 는 진홍 방사 fill, `plate` 는 비어 있는 각인판. */
  tone?: 'cta' | 'plate';
  drawable?: boolean;
  className?: string;
}

export function UdCartouche({ children, tone = 'cta', drawable, className }: UdCartoucheProps) {
  const classes = ['ud-cartouche', `ud-cartouche--${tone}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes}>
      <svg
        className="ud-cartouche-shape"
        viewBox="0 0 300 64"
        preserveAspectRatio="none"
        fill="none"
        {...decorative}
      >
        {/* 오목 브래킷 양끝 + 상하 코너 챔퍼. */}
        <path
          className="ud-cartouche-outline"
          d="M14 3 H286 L297 14 q-6 18 0 36 L286 61 H14 L3 50 q6 -18 0 -36 Z"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className={drawable ? 'ud-cartouche-rule ud-draw' : 'ud-cartouche-rule'}
          d="M20 8 H280 L291 17 q-5 15 0 30 L280 56 H20 L9 47 q5 -15 0 -30 Z"
          stroke="currentColor"
          strokeWidth="1"
          strokeOpacity="0.6"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="ud-cartouche-body">{children}</span>
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   8. 라인아트 글리프 24×24 — 메달리온과 카드 아이콘에 꽂는다.
   ══════════════════════════════════════════════════════════════════════════ */

export type UdGlyphName = 'knot' | 'lantern' | 'petal' | 'seal' | 'crescent' | 'thread' | 'gate';

const GLYPH_PATHS: Record<UdGlyphName, ReactNode> = {
  /* 매듭 — 위아래로 겹친 두 고리와 늘어진 끈. */
  knot: (
    <>
      <path d="M12 8 C8 4 4 6 4 9 C4 12 8 12 12 8 C16 12 20 12 20 9 C20 6 16 4 12 8 Z" />
      <path d="M12 16 C8 20 4 18 4 15 C4 12 8 12 12 16 C16 12 20 12 20 15 C20 18 16 20 12 16 Z" />
      <path d="M12 2 V8 M12 16 V22" />
    </>
  ),
  /* 등불 — 처마 아래 매달린 불. */
  lantern: (
    <>
      <path d="M6 5 h12 M12 5 V3" />
      <path d="M8 7 h8 l1.6 8 q0 4 -5.6 4 q-5.6 0 -5.6 -4 L8 7 Z" />
      <path d="M12 10 v5" />
    </>
  ),
  /* 연꽃잎. */
  petal: (
    <>
      <path d="M12 20 q-8 -3 -8 -8 q4 0 8 4 q4 -4 8 -4 q0 5 -8 8" />
      <path d="M12 20 q-4 -6 0 -14 q4 8 0 14" />
    </>
  ),
  /* 인장 — 사각 테두리 안의 획. */
  seal: (
    <>
      <path d="M4 4 h16 v16 H4 Z" />
      <path d="M8 9 h8 M8 13 h8 M12 9 v7" />
    </>
  ),
  /* 초승달. */
  crescent: <path d="M16.5 4 a9 9 0 1 0 0 16 a7 7 0 1 1 0 -16 Z" />,
  /* 붉은 실 한 오라기. */
  thread: <path d="M5 3 q7 4 2 9 q-5 5 2 9" />,
  /* 문 — 두 짝의 문과 문턱. */
  gate: (
    <>
      <path d="M4 20 V6 q8 -3 16 0 v14" />
      <path d="M12 6 v14 M3 20 h18" />
    </>
  )
};

export interface UdGlyphProps extends UdOrnamentProps {
  name: UdGlyphName;
}

export function UdGlyph({ name, size = 24, className, style }: UdGlyphProps) {
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...decorative}
    >
      {GLYPH_PATHS[name]}
    </svg>
  );
}

export const UdKnot = (props: UdOrnamentProps) => <UdGlyph name="knot" {...props} />;
export const UdLantern = (props: UdOrnamentProps) => <UdGlyph name="lantern" {...props} />;
export const UdPetal = (props: UdOrnamentProps) => <UdGlyph name="petal" {...props} />;
export const UdSeal = (props: UdOrnamentProps) => <UdGlyph name="seal" {...props} />;
export const UdCrescent = (props: UdOrnamentProps) => <UdGlyph name="crescent" {...props} />;

/* ══════════════════════════════════════════════════════════════════════════
   9. 메달리온 — 1px 금 링 + 내부 방사 글로우 + 글리프 슬롯.
   ══════════════════════════════════════════════════════════════════════════ */

export interface UdMedallionProps {
  glyph: UdGlyphName;
  size?: number;
  className?: string;
}

export function UdMedallion({ glyph, size = 60, className }: UdMedallionProps) {
  return (
    <span
      className={className ? `ud-medallion ${className}` : 'ud-medallion'}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <UdGlyph name={glyph} size={Math.round(size * 0.42)} className="ud-medallion-glyph" />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   10. 장 구분선 — 헤어라인 + 초승달 + 구름 스크롤 컬 2개 + 로젠지 종단.
   ══════════════════════════════════════════════════════════════════════════ */

export interface UdChapterRuleProps {
  className?: string;
  /** 구분선 가운데에 놓을 글자(예: 장 번호). 없으면 문양만 남는다. */
  label?: ReactNode;
}

export function UdChapterRule({ className, label }: UdChapterRuleProps) {
  return (
    <div className={className ? `ud-chapter-rule ${className}` : 'ud-chapter-rule'}>
      <svg
        className="ud-chapter-rule-art"
        viewBox="0 0 220 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        {...decorative}
      >
        <path d="M2 12 H74" />
        <path d="M146 12 H218" />
        {/* 로젠지 종단. */}
        <rect x="0" y="10" width="4" height="4" transform="rotate(45 2 12)" fill="currentColor" stroke="none" />
        <rect
          x="216"
          y="10"
          width="4"
          height="4"
          transform="rotate(45 218 12)"
          fill="currentColor"
          stroke="none"
        />
        {/* 구름 스크롤 컬. */}
        <path d="M78 12 q4 -7 9 -3 q3 3 -1 5 q-3 1 -4 -2" />
        <path d="M142 12 q-4 -7 -9 -3 q-3 3 1 5 q3 1 4 -2" />
        {/* 가운데 초승달. */}
        <path d="M116 5 a7 7 0 1 0 0 14 a5.4 5.4 0 1 1 0 -14 Z" />
      </svg>
      {label ? <span className="ud-chapter-rule-label">{label}</span> : null}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   11. 프렛 디바이더 — 뇌문 모티프 밴드. 세로 그라디언트 fill 로 아래를 청동으로.
   ══════════════════════════════════════════════════════════════════════════ */

export interface UdFretDividerProps {
  /** `narrow` = 140px 급 장 구분, `wide` = 335px 급 섹션 구분. */
  scale?: 'narrow' | 'wide';
  className?: string;
}

export function UdFretDivider({ scale = 'narrow', className }: UdFretDividerProps) {
  const width = scale === 'wide' ? 336 : 140;

  return (
    <svg
      className={className ? `ud-fret-divider ${className}` : 'ud-fret-divider'}
      width={width}
      height={Math.round((width * 20) / 168)}
      viewBox="0 0 168 20"
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      {...decorative}
    >
      {/* 각형 뇌문 미앤더: 곡선이 0개다. 좌우 대칭 두 벌 + 가운데 꽃 다이아.
          밀도를 낮춘 이유 — 이전 판은 한 변 16 짜리 미앤더를 변마다 세 벌씩
          2px 획으로 붙여 놔서, 140px 로 줄면 획 사이 여백이 사라지고 여섯 개의
          덩어리로 뭉쳤다(붉은 그라디언트와 겹쳐 'ㄲㄲㄲ ◆ ㄱㄱㄱ' 로 읽혔다).
          벌 수를 줄이고 사이를 벌리고 획을 1.25 로 얇게 해 필리그리로 되돌린다. */}
      <g stroke="url(#ud-grad-fret)" strokeWidth="1.25" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M2 14 H74 M94 14 H166" />
        <path d="M18 14 V7 H34 V11 H26" />
        <path d="M46 14 V7 H62 V11 H54" />
        <path d="M150 14 V7 H134 V11 H142" />
        <path d="M122 14 V7 H106 V11 H114" />
        {/* 가운데 꽃 다이아. 면이 아니라 윤곽선이라 붉은 덩어리가 생기지 않는다. */}
        <path d="M84 9 L89 14 L84 19 L79 14 Z" />
      </g>
      <circle cx="84" cy="14" r="1.5" fill="url(#ud-grad-fret)" />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   12. 숨표 — 헤드라인 두 줄 사이에 끼우는 1px × 72px 세로 헤어라인.
   ══════════════════════════════════════════════════════════════════════════ */

export function UdBreathRule({ className }: { className?: string }) {
  return (
    <span
      className={className ? `ud-breath ${className}` : 'ud-breath'}
      aria-hidden="true"
    />
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   13. 붉은 실 — 곡선 2~3갈래. 직선 2px 레일로 두면 어떤 색을 써도 UI 테두리로 읽힌다.
   ══════════════════════════════════════════════════════════════════════════
   아트 뒤에 깔고 opacity 0.35 이하로 낮춘다. `drawable` 이면 스크롤 리빌에서 그려진다. */

export interface UdThreadProps {
  /** 세로 길이(px). 컷 높이에 맞춘다. */
  height?: number;
  strands?: 1 | 2 | 3;
  drawable?: boolean;
  className?: string;
}

const STRAND_PATHS = [
  'M20 0 C6 120 34 200 18 320 C4 430 30 520 20 640',
  'M20 0 C32 90 8 190 26 300 C38 400 10 500 22 640',
  'M20 0 C14 150 36 240 12 360 C0 470 28 560 18 640'
] as const;

export function UdThread({ height = 640, strands = 2, drawable, className }: UdThreadProps) {
  return (
    <svg
      className={className ? `ud-thread ${className}` : 'ud-thread'}
      width="40"
      height={height}
      viewBox="0 0 40 640"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      {...decorative}
    >
      {STRAND_PATHS.slice(0, strands).map((d, index) => (
        <path
          key={d}
          className={drawable ? 'ud-draw' : undefined}
          style={{ '--ud-i': index, '--ud-draw-len': 1400 } as CSSProperties}
          d={d}
          strokeWidth={index === 0 ? 1.6 : 1}
          strokeOpacity={index === 0 ? 0.9 : 0.45}
        />
      ))}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   14. 말풍선 — 대사와 환경음을 갈라 놓는다.
   ══════════════════════════════════════════════════════════════════════════
   `dialogue` = 종이질 파치먼트 + 꼬리 + 드롭섀도.
   `ambient`  = 반투명 스크림, 꼬리 없음, 크림 글자. 침묵 컷의 환경음·속삭임.
   리포트 말풍선이 무료 티저보다 못한 역전(꼬리 · 그림자 없음)을 이 컴포넌트가 막는다. */

export type UdBubbleVariant = 'dialogue' | 'ambient';

export interface UdBubbleProps {
  children: ReactNode;
  variant?: UdBubbleVariant;
  /** 꼬리 방향. `dialogue` 에서만 쓴다. */
  tail?: 'left' | 'right' | 'none';
  /** 스태거 인덱스. `--ud-i` 로 전달되어 등장 지연이 된다. */
  index?: number;
  className?: string;
}

export function UdBubble({
  children,
  variant = 'dialogue',
  tail = 'left',
  index,
  className
}: UdBubbleProps) {
  const classes = [
    'ud-bubble',
    `ud-bubble--${variant}`,
    variant === 'dialogue' && tail !== 'none' ? `ud-bubble--tail-${tail}` : '',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <p className={classes} style={index ? ({ '--ud-i': index } as CSSProperties) : undefined}>
      {children}
    </p>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   15. 따옴표 — 인용 블록의 좌상 / 우하 대각선 배치.
   ══════════════════════════════════════════════════════════════════════════ */

export function UdQuoteMarks({ className }: { className?: string }) {
  const mark = (
    <svg viewBox="0 0 12 10" fill="currentColor" {...decorative}>
      <path d="M0 10 V5.2 Q0 1.4 3.4 0 L4.6 2 Q2.6 2.8 2.6 4.4 H4.8 V10 Z" />
      <path d="M7.2 10 V5.2 Q7.2 1.4 10.6 0 L11.8 2 Q9.8 2.8 9.8 4.4 H12 V10 Z" />
    </svg>
  );

  return (
    <span className={className ? `ud-quote-marks ${className}` : 'ud-quote-marks'} aria-hidden="true">
      <span className="ud-quote-mark ud-quote-mark--open">{mark}</span>
      <span className="ud-quote-mark ud-quote-mark--close">{mark}</span>
    </span>
  );
}
