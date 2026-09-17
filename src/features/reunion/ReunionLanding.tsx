import { ArrowRight, CalendarClock, ChevronsDown, MessageCircleMore, ShieldCheck } from 'lucide-react';
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
/* reunion.css 는 import 하지 않는다.
   이 랜딩에서 실제로 매칭되던 규칙은 .reunion-page 리셋·포커스와 .reunion-visually-hidden 뿐이라
   reunion-webtoon.css 상단으로 옮겨 놓았다. reunion.css 는 Intake/Preview/ReportView 가 계속 쓴다. */
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

const standardIcons = {
  calendar: CalendarClock,
  message: MessageCircleMore,
  shield: ShieldCheck
} as const;

/* ── 인라인 SVG 장식 ──────────────────────────────────────────── */

function FrameCorner() {
  return (
    <svg viewBox="0 0 46 46" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M1 14V1h13" />
      <path d="M6 20V6h14" />
      <path d="M1 26v-6" />
      <path d="M26 1h-6" />
    </svg>
  );
}

function StopMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="9" cy="9" r="7.2" />
      <path d="M4.3 13.7 13.7 4.3" />
    </svg>
  );
}

function ChapterMoon() {
  return (
    <svg
      className="rw-chapter-moon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <path d="M9.6 1.4a6 6 0 1 0 3 10.5A6.6 6.6 0 0 1 9.6 1.4Z" />
    </svg>
  );
}

/** 명판 좌우를 지키는 석등. 시안의 처마 등·석등 모티프를 초승달과 짝이 되게 옮긴 것. */
function PlateLantern() {
  return (
    <svg
      className="rw-plate-lantern"
      width="14"
      height="26"
      viewBox="0 0 14 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      aria-hidden="true"
    >
      <path d="M7 0v3" />
      <path d="M1.6 4.6h10.8" />
      <path d="M3 4.6h8l-1 3.2H4z" />
      <rect x="2.4" y="7.8" width="9.2" height="9" rx="1" />
      <path d="M3.4 17.4h7.2l-1.1 2.6H4.5z" />
      <path d="M7 20v2.4" />
      <path d="M4.6 23.4h4.8" />
      <circle cx="7" cy="12.3" r="2.1" fill="currentColor" stroke="none" opacity="0.55" />
    </svg>
  );
}

/* ── 말풍선 ──────────────────────────────────────────────────── */
/* 오직 독자 본인의 속마음만 담는다. 지시·판단·약속·수치·시기는 넣지 않는다. */
function RwBubble({ bubble }: { bubble: ReunionBubble }) {
  return (
    <div
      className="rw-bubble"
      data-side={bubble.side}
      style={{ '--rw-top': bubble.top, '--rw-i': bubble.i } as CSSProperties}
    >
      <span className="reunion-visually-hidden">혼잣말</span>
      <p className="rw-bubble-text">{renderMultiline(bubble.text)}</p>
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

function Mechanic({ cut }: { cut: ReunionCut }) {
  switch (cut.mechanic) {
    case 'stopList':
      return (
        <ul className="rw-stop" role="list">
          {stopActions.map((action) => (
            <li className="rw-stop-item" key={action}>
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
          {standards.map((item) => {
            const Icon = standardIcons[item.icon];
            return (
              <li className="rw-card" key={item.title}>
                <Icon size={22} aria-hidden="true" />
                <h3 className="rw-card-title">{item.title}</h3>
                <p>{item.body}</p>
              </li>
            );
          })}
        </ul>
      );

    case 'compare':
      return (
        <div className="rw-compare">
          <div className="rw-compare-col is-guess">
            <h3>추측이 채우던 것</h3>
            <ul role="list">
              {compareGuess.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <span className="rw-compare-glyph" aria-hidden="true">
            ／
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
          {denyItems.map((item) => (
            <li className="rw-deny-item" key={item}>
              <ShieldCheck size={16} aria-hidden="true" />
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
            <li key={item}>
              <span className="rw-parts-num">{String(index + 1).padStart(2, '0')}</span>
              <strong>{item}</strong>
            </li>
          ))}
        </ol>
      );

    /* 13 은 "섞지 않는다"는 원칙이다. 왼쪽은 입력 서식, 오른쪽은 계산 항목 태그로
       형태를 확실히 갈라 둔다. 오른쪽에 값을 붙이면 14 의 명식 표와 같은 표가 두 번 나온다. */
    case 'panes':
      return (
        <div className="rw-panes">
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
       4기둥(시주·일주·월주·년주) 원국표는 이 상품이 출력하지 않으므로 여기에도 만들지 않는다. */
    case 'myeongsik':
      return (
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
                    <li className="rw-ms-cell" data-el={cell.el} key={cell.el}>
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
      );

    case 'branch':
      return (
        <ul className="rw-branch" role="list">
          {branchRows.map((row) => (
            <li className="rw-branch-row" data-verdict={row.verdict} key={row.label}>
              <span className="rw-branch-label">{row.label}</span>
              <span className="rw-branch-chip">{row.chip}</span>
            </li>
          ))}
        </ul>
      );

    /* 게이지와 타임라인은 한 블록이다. 절대 분리하지 않는다.
       마크업은 reunionMeters.tsx 에 있고 리포트 화면이 같은 것을 실제 값으로 그린다.
       여기서는 값이 비어 있는 상태가 곧 '우리가 채우지 않는 칸'이라는 메시지다. */
    case 'gaugeTimeline':
      return (
        <div className="rw-gauge-block">
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
        <>
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
        </>
      );

    case 'gate':
      return (
        <>
          <div className="rw-ledger">
            <span className="rw-ledger-label">재회운</span>
            <strong className="rw-ledger-num">
              {REUNION_PRICE.toLocaleString('ko-KR')}
              <span className="rw-ledger-unit">원</span>
            </strong>
            <span className="rw-ledger-note">1회 결제</span>
          </div>
          <ol className="rw-steps" role="list">
            {gateSteps.map((step, index) => (
              <li key={step}>
                <span className="rw-step-num" aria-hidden="true">
                  {'①②③④'[index]}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="rw-gate-consent">
            상대방의 생년월일(가능하면 태어난 시간)이 필요하며, 상대방이 제공했거나 서비스 이용에 동의한
            정보만 입력합니다.
          </p>
          <p className="rw-gate-refund">
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

function RwCta({ small, strong }: { small: string; strong: string }) {
  return (
    <Link to={REUNION_PATHS.intake} className="rw-cta">
      <span className="rw-cta-stack">
        <small>{small}</small>
        <strong>{strong}</strong>
      </span>
      <ArrowRight size={20} aria-hidden="true" />
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

function CutFigure({ id }: { id: ReunionPanelId }) {
  const art = reunionPanelArt[id];
  if (!art.image) return null;

  const isBackdrop = backdropPanels.has(id);

  return (
    <figure
      className={`rw-fig rw-fig--p${id}${isBackdrop ? ' is-backdrop' : ''}`}
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
      style={{ '--rw-h': `${cut.height}px` } as CSSProperties}
    >
      {/* 컷 번호는 20개 모두에 붙는 좌표다. 킥커 유무와 무관하게 항상 코너에 둔다.
          시각 표시 전용이므로 접근성 트리에서는 감춘다(필요한 값은 data-panel 이 갖는다). */}
      <span className="rw-count" aria-hidden="true">
        {cut.n}
      </span>

      {art.image && isOverlayArt ? <CutFigure id={cut.n} /> : null}

      {art.image && !isOverlayArt ? (
        <div className="rw-stage">
          <CutFigure id={cut.n} />
          {hasBubbles
            ? (cut.bubbles as ReunionBubble[]).map((bubble) => (
                <RwBubble bubble={bubble} key={bubble.text} />
              ))
            : null}
        </div>
      ) : null}

      {cut.silent ? (
        <>
          <p className="rw-silent">{cut.silent}</p>
          {cut.n === '05' ? (
            <span className="rw-echo" aria-hidden="true">
              {cut.silent}
            </span>
          ) : null}
          {cut.n === '02' ? <span className="rw-breath" aria-hidden="true" /> : null}
        </>
      ) : null}

      <div className="rw-copy">
        {cut.kicker ? <p className="rw-kicker">{cut.kicker}</p> : null}

        {cut.badge ? <p className="rw-badge">{cut.badge}</p> : null}

        {cut.plate ? (
          <div className="rw-plate">
            <span className="rw-plate-corner" aria-hidden="true" />
            <span className="rw-plate-corner" aria-hidden="true" />
            <span className="rw-plate-corner" aria-hidden="true" />
            <span className="rw-plate-corner" aria-hidden="true" />
            <span className="rw-plate-seal">{cut.plate.seal}</span>
            <span className="rw-plate-act">
              <PlateLantern />
              {cut.plate.act}
              <PlateLantern />
            </span>
            <strong className="rw-plate-title">{cut.plate.title}</strong>
          </div>
        ) : null}

        {cut.headline ? (
          <Heading className="rw-head">{renderHeadline(cut.headline)}</Heading>
        ) : null}

        {beforeBody ? <Mechanic cut={cut} /> : null}

        {cut.body ? <p className="rw-body">{cut.body}</p> : null}

        {!beforeBody ? <Mechanic cut={cut} /> : null}

        {isCover ? (
          <>
            <RwCta small="약 3분, 4단계 입력" strong="무료 미리보기부터 보기" />
            <p className="rw-cta-sub">결제 전 미리보기까지 무료 · 전체 리포트는 990원, 1회 결제</p>
            <span className="rw-scroll-hint" aria-hidden="true">
              <ChevronsDown size={22} />
            </span>
          </>
        ) : null}

        {cut.note ? (
          <aside className="rw-note">
            <span className="rw-note-label">운월당</span>
            <p className="rw-note-body">{cut.note}</p>
          </aside>
        ) : null}

        {cut.n === '04' ? <p className="rw-chip">사용자 입력 · 미확인</p> : null}

        {cut.caption ? <p className="rw-caption">{cut.caption}</p> : null}

        {cut.kind === 'offer' ? (
          <>
            <RwCta small="약 3분, 4단계 입력" strong="무료 미리보기부터 보기" />
            <p className="rw-cta-sub">결제 전 미리보기까지 무료 · 전체 리포트 990원, 1회 결제</p>
            <p className="rw-disclaimer">
              본 콘텐츠는 전통 명리학 기반의 참고 자료이며 상대방의 연락, 감정 또는 재회를 보장하지
              않습니다.
            </p>
          </>
        ) : null}
      </div>

      {cut.chapterFoot ? (
        <p className="rw-chapter-foot">
          <ChapterMoon />
          {cut.chapterFoot}
        </p>
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
    <div className="reunion-page reunion-landing reunion-webtoon">
      <div className="rw-frame" aria-hidden="true">
        <span className="rw-frame-corner is-tl">
          <FrameCorner />
        </span>
        <span className="rw-frame-corner is-tr">
          <FrameCorner />
        </span>
        <span className="rw-frame-corner is-bl">
          <FrameCorner />
        </span>
        <span className="rw-frame-corner is-br">
          <FrameCorner />
        </span>
      </div>

      <div className="rw-thread" aria-hidden="true">
        <i className="rw-thread-spark" />
        <i className="rw-thread-spark" />
        <i className="rw-thread-spark" />
      </div>

      <header className="rw-topbar">
        <Link to="/" className="rw-wordmark" aria-label="운월당 홈으로 이동">
          <span aria-hidden="true">緣</span>
          <strong>운월당</strong>
        </Link>
        <Link to={REUNION_PATHS.intake} className="rw-topbar-link">
          바로 시작
        </Link>
      </header>

      <main ref={rootRef} className="rw-main">
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
            <h2 id="rw-legal-title" className="rw-legal-title">
              이용 안내
            </h2>
            <ul className="rw-legal-list" role="list">
              {legalItems.map((item) => (
                <li key={item}>{item}</li>
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
          className="rw-cta"
          tabIndex={showDock ? undefined : -1}
        >
          <span className="rw-cta-stack">
            <small>미리보기까지 무료</small>
            <strong>재회운 시작하기</strong>
          </span>
          <ArrowRight size={20} aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}
