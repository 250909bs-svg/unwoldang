import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref
} from 'react';
import { Link } from 'react-router-dom';
import ReunionPanelPicture from './ReunionPanelPicture';
import { reunionPanelArt, type ReunionPanelId } from './reunionPanelAssets';
import {
  ReunionMeterBand,
  ReunionMeterGauge,
  ReunionMeterTally,
  ReunionMeterTimeline
} from './reunionMeters';
import {
  UdBubble,
  UdCartouche,
  UdCorners,
  UdCrescent,
  UdFrameBox,
  UdFretDivider,
  UdGlyph,
  UdLantern,
  UdMedallion,
  UdOrnamentDefs,
  UdPlaque,
  UdThread,
  type UdGlyphName
} from './reunionOrnaments';
import { REUNION_PATHS, REUNION_PRICE } from './reunionFlow';
import {
  actTitles,
  actionTimeline,
  branchRows,
  calcTags,
  compareGuess,
  compareReport,
  denyItems,
  footerLines,
  gateSteps,
  legalItems,
  myeongsik,
  reportParts,
  reunionCuts,
  standards,
  stopActions,
  tallyItems,
  userPane,
  type ReunionBubble,
  type ReunionCut,
  type ReunionCutMechanic
} from '../../content/reunionWebtoonPanels';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { useReunionParallax } from './useReunionParallax';
/* reunion.css 는 import 하지 않는다.
   이 랜딩에서 실제로 매칭되던 규칙은 .reunion-page 리셋·포커스와 .reunion-visually-hidden 뿐이라
   reunion-webtoon.css 상단으로 옮겨 놓았다. reunion.css 는 Intake/Preview/ReportView 가 계속 쓴다.

   프리미엄 시트가 먼저다. 토큰·유틸리티·모션 패턴을 그것이 소유하고,
   화면 시트(reunion-webtoon.css)가 나중에 로드되어 컷별 조정으로 이긴다. */
import '../../styles/reunion-premium.css';
import '../../styles/reunion-webtoon.css';

/** '\n' → <br />, [강조] → <em class="rw-hot">. CSS 자동 줄바꿈에 맡기지 않는다. */
function renderHeadline(text: string): ReactNode {
  return text.split('\n').map((line, lineIndex) => (
    <Fragment key={`${line}-${lineIndex}`}>
      {lineIndex > 0 ? <br /> : null}
      {line.split(/(\[[^\]]+\])/).map((chunk, chunkIndex) =>
        chunk.startsWith('[') && chunk.endsWith(']') ? (
          <em className="rw-hot" key={chunkIndex}>
            {chunk.slice(1, -1)}
          </em>
        ) : (
          <Fragment key={chunkIndex}>{chunk}</Fragment>
        )
      )}
    </Fragment>
  ));
}

function renderMultiline(text: string): ReactNode {
  return text.split('\n').map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

/* ── 글자 단위 등장 (.ud-ink) ─────────────────────────────────────
   디자인 시스템 규격: 히어로·장 제목 전용, 16자 이하. 그보다 길면 글자가
   한 자씩 들어오는 동안 읽는 속도를 방해한다. 줄바꿈이나 [강조] 가 있는 문장은
   구조가 있으므로 대상이 아니다. */

const INK_MAX_GRAPHEMES = 16;

function canInk(text: string): boolean {
  return !text.includes('\n') && !text.includes('[') && Array.from(text).length <= INK_MAX_GRAPHEMES;
}

/**
 * 글자를 span 으로 쪼개면 스크린리더가 한 자씩 읽는 브라우저가 있다.
 * 그래서 시각 층은 aria-hidden 으로 감추고 문장 전체를 한 번 따로 읽힌다.
 */
function InkText({ text }: { text: string }) {
  let index = 0;

  return (
    <>
      <span className="reunion-visually-hidden">{text}</span>
      <span className="ud-ink" aria-hidden="true">
        {Array.from(text).map((character, position) =>
          character === ' ' ? (
            <span data-space="true" key={position} />
          ) : (
            <span style={{ '--ud-i': index++ } as CSSProperties} key={position}>
              {character}
            </span>
          )
        )}
      </span>
    </>
  );
}

/* ── 인라인 아이콘 ────────────────────────────────────────────────
   lucide 의 둥근 스트로크 아이콘은 이 페이지의 장식 계열(1.1px 라인아트 · 뇌문 ·
   등불)과 선 성격이 달라서 한 화면에 섞이면 값싸 보인다. 여기서 쓰는 세 개는
   장식 라이브러리와 같은 규약(currentColor · aria-hidden · 1.1~1.4 스트로크)으로 그린다. */

function RwArrow() {
  return (
    <svg
      className="rw-cta-arrow"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 10h13" />
      <path d="M11 5l5 5-5 5" />
    </svg>
  );
}

function RwScrollHint() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7l7 6 7-6" />
      <path d="M4 13l7 6 7-6" />
    </svg>
  );
}

function StopMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="9" r="7.2" />
      <path d="M4.3 13.7 13.7 4.3" />
    </svg>
  );
}

/** 원칙 카드(08)의 메달리온 글리프. content 의 의미 키를 장식 글리프로 옮긴다. */
const standardGlyphs = {
  calendar: 'crescent',
  message: 'thread',
  shield: 'gate'
} as const satisfies Record<(typeof standards)[number]['icon'], UdGlyphName>;

/* ── 말풍선 ──────────────────────────────────────────────────── */
/* 오직 독자 본인의 속마음만 담는다. 지시·판단·약속·수치·시기는 넣지 않는다.
   껍데기(종이질 · 꼬리 · 그림자)는 .ud-bubble 이, 아트 위 좌표는 이 래퍼가 맡는다. */
function RwBubble({ bubble }: { bubble: ReunionBubble }) {
  return (
    <div
      className="rw-bubble ud-onart"
      data-side={bubble.side}
      style={{ '--rw-top': bubble.top, '--rw-i': bubble.i } as CSSProperties}
    >
      <span className="reunion-visually-hidden">혼잣말</span>
      <UdBubble variant="dialogue" tail={bubble.side} className="rw-bubble-text ud-settle">
        {renderMultiline(bubble.text)}
      </UdBubble>
    </div>
  );
}

/**
 * 마스킹 자리표시자.
 * '○' 는 시각적 자리표시자일 뿐이므로 접근성 트리에서 감추고 대체 텍스트를 한 번만 남긴다.
 */
function MaskValue({ text }: { text: string }) {
  return (
    <>
      <span className="rw-mask" aria-hidden="true">
        {text}
      </span>
      <span className="reunion-visually-hidden">예시 값</span>
    </>
  );
}

/* ── 메커닉 블록 ─────────────────────────────────────────────── */

const mechanicBeforeBody: ReadonlySet<ReunionCutMechanic> = new Set<ReunionCutMechanic>([
  'compare',
  'parts',
  'panes',
  'myeongsik',
  'branch',
  'gaugeTimeline',
  'timingBand'
]);

/** 스태거 인덱스를 넘기는 인라인 스타일. --ud-i × 90ms 가 .ud-tick 의 지연이다. */
const tick = (index: number) => ({ '--ud-i': index } as CSSProperties);

function Mechanic({ cut }: { cut: ReunionCut }) {
  switch (cut.mechanic) {
    case 'stopList':
      return (
        <ul className="rw-stop" role="list">
          {stopActions.map((action, index) => (
            <li className="rw-stop-item ud-tick" style={tick(index)} key={action}>
              <span className="rw-stop-mark" aria-hidden="true">
                <StopMark />
              </span>
              <p>{action}</p>
            </li>
          ))}
        </ul>
      );

    case 'standards':
      return (
        <ul className="rw-cards" role="list">
          {standards.map((item, index) => (
            <li className="rw-card ud-tick" style={tick(index)} key={item.title}>
              <UdMedallion glyph={standardGlyphs[item.icon]} size={52} />
              <h3 className="rw-card-title">{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      );

    case 'compare':
      return (
        <div className="rw-compare ud-rise">
          <div className="rw-compare-col is-guess">
            <h3>추측이 채우던 것</h3>
            <ul role="list">
              {compareGuess.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <span className="rw-compare-glyph" aria-hidden="true">
            <UdGlyph name="seal" size={14} />
          </span>
          <div className="rw-compare-col is-report">
            <h3>리포트가 확인해 주는 것</h3>
            <ul role="list">
              {compareReport.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      );

    case 'deny':
      return (
        <ul className="rw-deny" role="list">
          {denyItems.map((item, index) => (
            <li className="rw-deny-item ud-tick" style={tick(index)} key={item}>
              <UdGlyph name="seal" size={16} />
              <span className="rw-deny-text">{item}</span>
              <span className="rw-deny-veil" aria-hidden="true" />
            </li>
          ))}
        </ul>
      );

    case 'parts':
      return (
        <ol className="rw-parts" role="list">
          {reportParts.map((item, index) => (
            <li className="ud-tick" style={tick(index)} key={item}>
              <span className="rw-parts-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <strong>{item}</strong>
            </li>
          ))}
        </ol>
      );

    /* 13 은 "섞지 않는다"는 원칙이다. 왼쪽은 입력 서식, 오른쪽은 계산 항목 태그로
       형태를 확실히 갈라 둔다. 오른쪽에 값을 붙이면 14 의 명식 표와 같은 표가 두 번 나온다. */
    case 'panes':
      return (
        <div className="rw-panes ud-rise">
          <div className="rw-panes-pane is-input">
            <span className="rw-panes-badge">사용자 입력 · 미확인</span>
            <dl className="rw-panes-rows">
              {userPane.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    <MaskValue text={row.value} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rw-panes-pane is-calc">
            <span className="rw-panes-badge">계산 근거 확인</span>
            <ul className="rw-calc-tags" role="list">
              {calcTags.map((tag) => (
                <li key={tag}>
                  <span className="rw-calc-mark" aria-hidden="true" />
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );

    /* 14 명식 표. 재회운 리포트가 실제로 출력하는 네 줄만 세운다.
       4기둥(시주·일주·월주·년주) 원국표는 이 상품이 출력하지 않으므로 여기에도 만들지 않는다.
       시안 5.png 의 금테 이중 액자 + 로제트 코너 + 오행 웰을 그대로 옮긴 자리다. */
    case 'myeongsik':
      return (
        <UdFrameBox tone="gilt" corner="rosette" className="rw-ms-frame ud-rise">
          <div className="rw-ms">
            <dl className="rw-ms-rows">
              <div className="rw-ms-row is-stem">
                <dt>{myeongsik.dayMaster.label}</dt>
                <dd>
                  <span className="rw-ms-tile" aria-hidden="true">
                    <strong>{myeongsik.dayMaster.stem}</strong>
                    <small>{myeongsik.dayMaster.element}</small>
                  </span>
                  <span className="reunion-visually-hidden">예시 값</span>
                </dd>
              </div>

              <div className="rw-ms-row is-elements">
                <dt>{myeongsik.elementsLabel}</dt>
                <dd>
                  <ul className="rw-ms-cells" role="list">
                    {myeongsik.elements.map((cell) => (
                      <li className="rw-ms-cell ud-well" data-el={cell.el} key={cell.el}>
                        <span className="rw-ms-cell-glyph ud-hanja" aria-hidden="true">
                          {cell.hanja}
                        </span>
                        <span className="rw-ms-cell-name">{cell.name}</span>
                        <span className="rw-ms-cell-count" aria-hidden="true">
                          {cell.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <span className="reunion-visually-hidden">다섯 칸의 개수는 모두 예시 값</span>
                </dd>
              </div>

              <div className="rw-ms-row is-helpful">
                <dt>{myeongsik.helpful.label}</dt>
                <dd>
                  {myeongsik.helpful.chips.map((chip, index) => (
                    <span className="rw-ms-chip" aria-hidden="true" key={index}>
                      {chip}
                    </span>
                  ))}
                  <span className="reunion-visually-hidden">예시 값</span>
                </dd>
              </div>

              <div className="rw-ms-row is-dayun">
                <dt>{myeongsik.dayun.label}</dt>
                <dd>
                  <MaskValue text={myeongsik.dayun.value} />
                </dd>
              </div>
            </dl>
          </div>
        </UdFrameBox>
      );

    case 'branch':
      return (
        <ul className="rw-branch ud-rise" role="list">
          {branchRows.map((row) => (
            <li className="rw-branch-row" data-verdict={row.verdict} key={row.label}>
              <span className="rw-branch-label">{row.label}</span>
              <span className="rw-branch-chip ud-num">{row.chip}</span>
            </li>
          ))}
        </ul>
      );

    /* 게이지와 타임라인은 한 블록이다. 절대 분리하지 않는다.
       마크업은 reunionMeters.tsx 에 있고 리포트 화면이 같은 것을 실제 값으로 그린다.
       여기서는 값이 비어 있는 상태가 곧 '우리가 채우지 않는 칸'이라는 메시지다. */
    case 'gaugeTimeline':
      return (
        <div className="rw-gauge-block ud-rise">
          <ReunionMeterGauge
            ns="rw"
            cells={[{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }]}
          />
          {cut.gaugeCaption ? <p className="rw-gauge-caption">{cut.gaugeCaption}</p> : null}
          <ReunionMeterTimeline
            ns="rw"
            nodes={actionTimeline.map((node) => ({
              id: node.when,
              when: node.when,
              count: node.count
            }))}
          />
        </div>
      );

    case 'timingBand':
      return (
        <div className="rw-window-block ud-rise">
          <ReunionMeterBand
            ns="rw"
            ticks={Array.from({ length: 12 }, (_unused, index) => ({
              id: String(index),
              marked: index === 6
            }))}
            ticksHidden
            label="○○○○년 ○월 · ○○"
            labelHidden
            srText="참고 구간 예시 표기"
            note={cut.bandNote}
          />
          <ReunionMeterTally
            ns="rw"
            items={tallyItems.map((item) => ({
              id: item.label,
              num: item.num,
              unit: item.unit,
              label: item.label
            }))}
            foot={cut.tallyFoot}
          />
        </div>
      );

    case 'gate':
      return (
        <>
          {/* weight 3 → 2. 금테 최대 강조가 가격 카드에 걸려 있으면 페이지에서
              가장 비싸 보이는 장치가 가장 싼 숫자를 가리킨다. */}
          <UdFrameBox tone="gilt" corner="fret" weight={2} className="rw-ledger-frame ud-rise">
            <p className="rw-ledger">
              <span className="rw-ledger-label">재회운</span>
              <strong className="rw-ledger-num ud-num ud-gilt-text">
                {REUNION_PRICE.toLocaleString('ko-KR')}
                <span className="rw-ledger-unit">원</span>
              </strong>
              <span className="rw-ledger-note">1회 결제</span>
            </p>
          </UdFrameBox>
          <ol className="rw-steps" role="list">
            {gateSteps.map((step, index) => (
              <li className="ud-tick" style={tick(index)} key={step}>
                <span className="rw-step-num ud-num" aria-hidden="true">
                  {'①②③④'[index]}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="rw-gate-consent ud-rise">
            상대방의 생년월일(가능하면 태어난 시간)이 필요하며, 상대방이 제공했거나 서비스 이용에 동의한
            정보만 입력합니다.
          </p>
          <p className="rw-gate-refund ud-rise">
            리포트가 생성되어 열람 가능한 상태가 된 뒤에는 디지털 콘텐츠 특성상 환불이 제한될 수 있습니다.{' '}
            <Link to="/refund">환불정책</Link>
          </p>
        </>
      );

    default:
      return null;
  }
}

/* ── CTA ─────────────────────────────────────────────────────── */
/* 형태(오목 브래킷 + 45도 챔퍼 + 진홍 방사 fill)는 .ud-cartouche 가 소유한다.
   `drawable` 이면 리빌 루트 안에서 내부 금선이 그려진다(.ud-draw). */

function RwCta({ small, strong, drawable }: { small: string; strong: string; drawable?: boolean }) {
  return (
    <Link to={REUNION_PATHS.intake} className="rw-cta ud-pressable ud-focusable">
      <UdCartouche tone="cta" drawable={drawable}>
        <span className="rw-cta-stack">
          <small>{small}</small>
          <strong>{strong}</strong>
        </span>
        <RwArrow />
      </UdCartouche>
    </Link>
  );
}

/* ── 패널 ────────────────────────────────────────────────────── */

/**
 * 컷 배경으로 깔리는 아트.
 * 이 다섯 패널의 figure 는 position:absolute 이므로 포함 블록이 .rw-cut 이어야 한다.
 * .rw-stage(높이 0) 안에 두면 그림이 높이 0 으로 렌더되어 전송만 하고 화면에 안 나온다.
 */
const overlayArtPanels: ReadonlySet<ReunionPanelId> = new Set<ReunionPanelId>([
  '02',
  '05',
  '14',
  '17',
  '20'
]);

/** 컷 전면을 덮는 배경 아트 (말풍선 없는 컷만). */
const backdropPanels: ReadonlySet<ReunionPanelId> = new Set<ReunionPanelId>(['14', '17', '20']);

/** 패럴랙스는 컷당 1개, 배경 아트에만 건다(디자인 시스템 규칙). */
const parallaxDepth: Readonly<Partial<Record<ReunionPanelId, string>>> = {
  '14': '20px',
  '17': '24px',
  '20': '18px'
};

function CutFigure({ id }: { id: ReunionPanelId }) {
  const art = reunionPanelArt[id];
  if (!art.image) return null;

  const isBackdrop = backdropPanels.has(id);
  const classes = [
    'rw-fig',
    `rw-fig--p${id}`,
    isBackdrop ? 'is-backdrop' : '',
    /* 표지는 LCP 후보다. 리빌·레이어 승격을 붙이지 않고 처음부터 최종 상태로 그린다. */
    id === '01' ? '' : 'ud-settle',
    parallaxDepth[id] ? 'ud-float' : ''
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <figure
      className={classes}
      style={parallaxDepth[id] ? ({ '--ud-depth': parallaxDepth[id] } as CSSProperties) : undefined}
      aria-hidden={art.decorative ? true : undefined}
    >
      <ReunionPanelPicture
        image={art.image}
        className="rw-fig-pic"
        alt={art.alt}
        eager={art.eager}
      />
      <span className="rw-fig-fade" aria-hidden="true" />
      <span className="rw-fig-tint" aria-hidden="true" />
    </figure>
  );
}

function Cut({ cut, cutRef }: { cut: ReunionCut; cutRef?: Ref<HTMLDivElement> }) {
  const art = reunionPanelArt[cut.n];
  const isCover = cut.kind === 'cover';
  const Heading = isCover ? 'h1' : 'h2';
  const hasBubbles = 'bubbles' in cut && Array.isArray(cut.bubbles) && cut.bubbles.length > 0;
  const beforeBody = cut.mechanic ? mechanicBeforeBody.has(cut.mechanic) : false;
  const isOverlayArt = overlayArtPanels.has(cut.n);
  const inkHeadline = Boolean(cut.headline && canInk(cut.headline));

  /* 컷은 div 다. 만화 컷은 독립 배포 가능한 단위가 아니라 article 의 의미에 맞지 않고,
     이름 없는 article/section 20개는 스크린리더에서 경계 소음이 된다.
     className / data-panel / ref 는 그대로라 CSS·테스트에 영향이 없다.

     표지는 리빌 대상에서 뺀다. 첫 화면을 JS 실행 뒤로 미루면 히어로 아트가
     LCP 후보에서 빠지고 eager/fetchpriority 도 무의미해진다. 처음부터 최종 상태로 그린다. */
  return (
    <div
      ref={cutRef}
      className={`rw-cut rw-cut--${cut.kind} rw-cut--p${cut.n}${isCover ? ' is-visible' : ''}`}
      data-panel={cut.n}
      data-reveal={isCover ? undefined : ''}
      data-parallax={parallaxDepth[cut.n] ? '' : undefined}
      style={{ '--rw-h': `${cut.height}px` } as CSSProperties}
    >
      {/* 컷 번호는 20개 모두에 붙는 좌표다. 킥커 유무와 무관하게 항상 코너에 둔다.
          시각 표시 전용이므로 접근성 트리에서는 감춘다(필요한 값은 data-panel 이 갖는다). */}
      <span className="rw-count ud-num ud-tick" aria-hidden="true">
        {cut.n}
      </span>

      {art.image && isOverlayArt ? <CutFigure id={cut.n} /> : null}

      {art.image && !isOverlayArt ? (
        <div className="rw-stage rw-stage--framed">
          <CutFigure id={cut.n} />
          <UdCorners kind="fret" size={22} inset={5} className="rw-stage-corners" />
          {hasBubbles
            ? (cut.bubbles as ReunionBubble[]).map((bubble) => (
                <RwBubble bubble={bubble} key={bubble.text} />
              ))
            : null}
        </div>
      ) : null}

      {cut.silent ? (
        <>
          <p className="rw-silent">
            <InkText text={cut.silent} />
          </p>
          {cut.n === '05' ? (
            <span className="rw-echo" aria-hidden="true">
              {cut.silent}
            </span>
          ) : null}
          {cut.n === '02' ? <span className="rw-breath ud-breath" aria-hidden="true" /> : null}
        </>
      ) : null}

      <div className={isCover ? 'rw-copy ud-bloom rw-cover-bloom' : 'rw-copy'}>
        {isCover ? (
          <span className="rw-seal rw-cover-seal">雲月堂</span>
        ) : null}

        {cut.kicker ? <p className="rw-kicker ud-rise">{cut.kicker}</p> : null}

        {cut.badge ? <p className="rw-badge ud-rise">{cut.badge}</p> : null}

        {cut.plate ? (
          <div className="rw-plate-wrap ud-bloom ud-bloom-in">
            <div className="rw-plate">
              <UdCorners kind="spandrel" size={22} inset={7} className="rw-plate-corners" />
              <UdPlaque>
                <span className="rw-seal">{cut.plate.seal}</span>
                <span className="rw-plate-act">
                  <UdLantern size={14} className="rw-plate-lantern" />
                  {cut.plate.act}
                  <UdLantern size={14} className="rw-plate-lantern" />
                </span>
                <span className="rw-plate-title-veil ud-veil">
                  <strong className="rw-plate-title">{cut.plate.title}</strong>
                </span>
              </UdPlaque>
            </div>
          </div>
        ) : null}

        {cut.headline ? (
          <Heading className="rw-head ud-rise">
            {inkHeadline ? <InkText text={cut.headline} /> : renderHeadline(cut.headline)}
          </Heading>
        ) : null}

        {beforeBody ? <Mechanic cut={cut} /> : null}

        {cut.body ? (
          <p className={isCover ? 'rw-lead ud-rise' : 'rw-body ud-rise'}>{cut.body}</p>
        ) : null}

        {!beforeBody ? <Mechanic cut={cut} /> : null}

        {isCover ? (
          <>
            <RwCta small="약 3분, 4단계 입력" strong="무료 미리보기부터 보기" />
            <p className="rw-cta-sub">결제 전 미리보기까지 무료 · 전체 리포트는 990원, 1회 결제</p>
            <span className="rw-scroll-hint" aria-hidden="true">
              <RwScrollHint />
            </span>
          </>
        ) : null}

        {cut.note ? (
          <aside className="rw-note ud-rise">
            <span className="rw-note-label">
              <UdGlyph name="crescent" size={12} />
              운월당
            </span>
            <p className="rw-note-body">{cut.note}</p>
          </aside>
        ) : null}

        {cut.n === '04' ? <p className="rw-chip ud-rise">사용자 입력 · 미확인</p> : null}

        {cut.sampleNote ? (
          <p className="rw-sample ud-sample-note ud-rise">{cut.sampleNote}</p>
        ) : null}

        {cut.caption ? <p className="rw-caption ud-rise">{cut.caption}</p> : null}

        {cut.kind === 'offer' ? (
          <>
            <RwCta small="약 3분, 4단계 입력" strong="무료 미리보기부터 보기" drawable />
            <p className="rw-cta-sub">결제 전 미리보기까지 무료 · 전체 리포트 990원, 1회 결제</p>
            <p className="rw-disclaimer">
              본 콘텐츠는 전통 명리학 기반의 참고 자료이며 상대방의 연락, 감정 또는 재회를 보장하지
              않습니다.
            </p>
          </>
        ) : null}
      </div>

      {cut.chapterFoot ? (
        <div className="rw-chapter-foot">
          <UdFretDivider scale="wide" />
          <p className="rw-chapter-foot-label">
            <UdCrescent size={13} className="rw-chapter-moon" />
            {cut.chapterFoot}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ── 페이지 ──────────────────────────────────────────────────── */

export default function ReunionLanding() {
  const rootRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLDivElement>(null);
  const [heroPassed, setHeroPassed] = useState(false);
  const [finalReached, setFinalReached] = useState(false);

  useRevealOnScroll(rootRef);
  useReunionParallax(rootRef);

  useEffect(() => {
    const hero = heroRef.current;
    const final = finalRef.current;

    if (!hero || !('IntersectionObserver' in window)) {
      setHeroPassed(true);
      return;
    }

    const heroObserver = new IntersectionObserver(
      ([entry]) => setHeroPassed(!entry.isIntersecting),
      { threshold: 0.16 }
    );
    heroObserver.observe(hero);

    let finalObserver: IntersectionObserver | undefined;
    if (final) {
      finalObserver = new IntersectionObserver(
        ([entry]) => setFinalReached(entry.isIntersecting),
        { threshold: 0.2 }
      );
      finalObserver.observe(final);
    }

    return () => {
      heroObserver.disconnect();
      finalObserver?.disconnect();
    };
  }, []);

  const showDock = heroPassed && !finalReached;
  const acts = [1, 2, 3, 4] as const;

  /* header/footer 는 <main> 밖에 둔다.
     article/aside/main/nav/section 의 후손인 header·footer 는 banner·contentinfo 로
     매핑되지 않는다. 이 라우트에는 전역 Footer 도 없어서 안에 두면 페이지에
     contentinfo 랜드마크가 아예 사라진다. */
  return (
    <div className="reunion-page reunion-landing reunion-webtoon ud-grain ud-vignette">
      {/* 문서 단위 SVG defs. 페이지당 한 번. 화면에는 아무것도 그리지 않는다. */}
      <UdOrnamentDefs />

      {/* 시안(4.png)의 페이지 네 귀 뇌문 코너. 셸 프레임 폭에 묶여 있다. */}
      <div className="rw-frame" aria-hidden="true">
        <UdCorners kind="fret" size={34} inset={0} className="rw-frame-inner" />
      </div>

      <header className="rw-topbar">
        <Link to="/" className="rw-wordmark ud-focusable" aria-label="운월당 홈으로 이동">
          <span aria-hidden="true">緣</span>
          <strong>운월당</strong>
        </Link>
        <Link to={REUNION_PATHS.intake} className="rw-topbar-link ud-pressable ud-focusable">
          바로 시작
        </Link>
      </header>

      <main ref={rootRef} className="rw-main">
        {/* 붉은 실. 직선 레일이 아니라 곡선 3갈래이고 스크롤 진입에서 그려진다.
            <main> 안에 두는 이유는 useRevealOnScroll 의 관찰 범위가 여기라서다. */}
        <div className="rw-thread" aria-hidden="true" data-reveal>
          <UdThread height={1000} strands={3} drawable />
          <i className="rw-thread-spark ud-spark" />
        </div>

        <div className="rw-strip">
          {acts.map((act) => (
            <section className={`rw-act rw-act--${act}`} aria-label={actTitles[act]} key={act}>
              {reunionCuts
                .filter((cut) => cut.act === act)
                .map((cut) => (
                  <Cut
                    cut={cut}
                    key={cut.n}
                    cutRef={cut.n === '01' ? heroRef : cut.n === '20' ? finalRef : undefined}
                  />
                ))}
            </section>
          ))}
        </div>

        {/* 이 라우트에는 전역 Footer 가 렌더되지 않는다. 사업자 정보는 필수다. */}
        <section className="rw-legal" aria-labelledby="rw-legal-title">
          <div className="rw-legal-inner">
            <div className="rw-legal-head">
              <UdFretDivider scale="narrow" />
              <h2 id="rw-legal-title" className="rw-legal-title">
                이용 안내
              </h2>
            </div>
            <ul className="rw-legal-list" role="list">
              {legalItems.map((item, index) => (
                <li className="ud-tick" style={tick(index)} key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="rw-footer">
        <div className="rw-footer-inner">
          {footerLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <nav className="rw-footer-nav" aria-label="법적 안내">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy">개인정보처리방침</Link>
            <Link to="/refund">환불정책</Link>
          </nav>
        </div>
      </footer>

      <aside
        className={`rw-dock${showDock ? ' is-visible' : ''}`}
        aria-label="재회운 시작"
        aria-hidden={!showDock}
      >
        <Link
          to={REUNION_PATHS.intake}
          className="rw-cta ud-pressable ud-focusable"
          tabIndex={showDock ? undefined : -1}
        >
          <UdCartouche tone="cta">
            <span className="rw-cta-stack">
              <small>미리보기까지 무료</small>
              <strong>재회운 시작하기</strong>
            </span>
            <RwArrow />
          </UdCartouche>
        </Link>
      </aside>
    </div>
  );
}
