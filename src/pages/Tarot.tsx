import type { CSSProperties } from 'react';
import { Eye, Heart, Lock, RefreshCw, Sparkles, Ticket, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MobileTopBar from '../components/MobileTopBar';
import {
  SECTION_META,
  TAROT_CARDS,
  generateTarotReading,
  type TarotMode,
  type TarotReading
} from '../lib/tarotMaterials';
import {
  claimDailyTarotMission,
  getRewardDateKey,
  readRewardWallet,
  spendLuckTickets,
  spendStars
} from '../lib/rewards';

type TarotPhase = 'select' | 'cards' | 'revealing' | 'reading';

const tarotModes = [
  {
    key: 'love' as const,
    label: '연애타로',
    shortLabel: '연애운',
    subtitle: '새로운 사랑의 시작과 현재 관계의 흐름',
    accentClass: 'rose',
    icon: Heart
  },
  {
    key: 'reunion' as const,
    label: '재회타로',
    shortLabel: '재회운',
    subtitle: '헤어진 인연의 감정과 다시 이어질 가능성',
    accentClass: 'indigo',
    icon: Sparkles
  },
  {
    key: 'marriage' as const,
    label: '결혼타로',
    shortLabel: '결혼운',
    subtitle: '결혼 시기와 배우자 흐름을 깊게 읽는 리딩',
    accentClass: 'amber',
    icon: Users
  }
];

const tarotModeGuide = {
  love: ['썸의 흐름', '새로운 인연', '감정의 온도'],
  reunion: ['상대의 마음', '다시 이어질 가능성', '재접점 시기'],
  marriage: ['결혼 시기', '현실 궁합', '배우자 흐름']
} as const;

function createShuffledDeck() {
  const deck = Array.from({ length: TAROT_CARDS.length }, (_, index) => index);

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[randomIndex]] = [deck[randomIndex], deck[index]];
  }

  return deck;
}

export default function Tarot() {
  const [mode, setMode] = useState<TarotMode>('love');
  const [phase, setPhase] = useState<TarotPhase>('select');
  const [deck, setDeck] = useState<number[]>(() => createShuffledDeck());
  const [revealingCardId, setRevealingCardId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [reading, setReading] = useState<TarotReading | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [wallet, setWallet] = useState(() => readRewardWallet());
  const [feedback, setFeedback] = useState<string | null>(null);

  const modeMeta = useMemo(() => tarotModes.find((item) => item.key === mode) || tarotModes[0], [mode]);
  const missionDoneToday = wallet.lastTarotMissionDate === getRewardDateKey();

  const readingSections = useMemo(() => {
    if (!reading) {
      return [];
    }

    const sections = reading.sections as unknown as Record<string, string>;

    return SECTION_META[mode].map((item, index) => ({
      ...item,
      index,
      content: sections[item.key] || ''
    }));
  }, [mode, reading]);

  const summaryLead = useMemo(() => {
    const firstLine = readingSections[0]?.content.split('\n')[0]?.trim();
    return firstLine || `${modeMeta.shortLabel}의 핵심 흐름을 한 장의 카드로 먼저 읽어낸 리딩입니다.`;
  }, [modeMeta.shortLabel, readingSections]);

  const selectedCard = selectedCardId !== null ? TAROT_CARDS[selectedCardId] : null;
  const freeSections = readingSections.slice(0, 2);
  const lockedSections = readingSections.slice(2);

  useEffect(() => {
    const syncWallet = () => setWallet(readRewardWallet());

    window.addEventListener('focus', syncWallet);
    window.addEventListener('storage', syncWallet);

    return () => {
      window.removeEventListener('focus', syncWallet);
      window.removeEventListener('storage', syncWallet);
    };
  }, []);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timer = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const unlockReading = (message: string) => {
    setIsUnlocking(true);
    setFeedback(message);

    window.setTimeout(() => {
      setIsUnlocked(true);
      setIsUnlocking(false);
    }, 820);
  };

  const handleModeSelect = (nextMode: TarotMode) => {
    setMode(nextMode);
    setDeck(createShuffledDeck());
    setRevealingCardId(null);
    setSelectedCardId(null);
    setReading(null);
    setIsUnlocked(false);
    setIsUnlocking(false);
    setPhase('cards');
  };

  const handleCardPick = (cardId: number) => {
    if (phase !== 'cards') {
      return;
    }

    setRevealingCardId(cardId);
    setPhase('revealing');

    window.setTimeout(() => {
      setSelectedCardId(cardId);
      setReading(generateTarotReading(cardId, mode));
      setIsUnlocked(false);
      setIsUnlocking(false);
      setPhase('reading');
    }, 1150);
  };

  const handleRedraw = () => {
    setDeck(createShuffledDeck());
    setRevealingCardId(null);
    setSelectedCardId(null);
    setReading(null);
    setIsUnlocked(false);
    setIsUnlocking(false);
    setPhase('cards');
  };

  const handleResetAll = () => {
    setMode('love');
    setDeck(createShuffledDeck());
    setRevealingCardId(null);
    setSelectedCardId(null);
    setReading(null);
    setIsUnlocked(false);
    setIsUnlocking(false);
    setPhase('select');
  };

  const handleUnlockWithTicket = () => {
    if (isUnlocked || isUnlocking) {
      return;
    }

    const result = spendLuckTickets(1);
    setWallet(result.wallet);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    unlockReading('행운권 1장으로 상세 리딩을 열고 있습니다.');
  };

  const handleUnlockWithStars = () => {
    if (isUnlocked || isUnlocking) {
      return;
    }

    const result = spendStars(10);
    setWallet(result.wallet);

    if (!result.ok) {
      setFeedback(result.message);
      return;
    }

    unlockReading('별 10개로 상세 리딩을 열고 있습니다.');
  };

  const handleClaimMission = () => {
    const result = claimDailyTarotMission(70);
    setWallet(result.wallet);
    setFeedback(result.message);
  };

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="타로" backTo="/" backLabel="홈" />

        <section className="mobile-page-content tarot-master-page">
          <section className="tarot-lounge-hero">
            <div className="tarot-lounge-sparkles" aria-hidden="true">
              <span className="sparkle one">✦</span>
              <span className="sparkle two">✧</span>
              <span className="sparkle three">✦</span>
              <span className="sparkle four">✧</span>
              <span className="sparkle five">✦</span>
              <span className="sparkle six">✧</span>
            </div>

            <img src="/tarot-lucky-amulet.png" alt="운월당 타로 마스코트" className="tarot-lounge-mascot" />

            <div className="tarot-lounge-copy">
              <h1>운월당 타로운세 ✧</h1>
              <p>마음에 드는 주제를 선택하고 카드를 골라주세요</p>
              <strong>✧ 오늘도 당신은 운월당과 함께하기를 ✧</strong>
            </div>

            <div className="tarot-lounge-tabs" role="tablist" aria-label="타로 주제 선택">
              {tarotModes.map((item) => {
                const Icon = item.icon;
                const active = mode === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? `tarot-lounge-tab active ${item.accentClass}` : 'tarot-lounge-tab'}
                    onClick={() => handleModeSelect(item.key)}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {phase === 'select' ? (
            null
          ) : null}

          {(phase === 'cards' || phase === 'revealing') ? (
            <>
              <section className="tarot-lounge-prompt">
                <strong>✧ 직감으로 카드 한 장을 선택해주세요</strong>
                <div className="tarot-master-draw-tags tarot-lounge-tags">
                  {tarotModeGuide[mode].map((tag) => (
                    <span key={`${mode}-${tag}`}>{tag}</span>
                  ))}
                </div>
              </section>

              <section className="tarot-master-selection-stage tarot-lounge-selection-stage">
                <div className={`tarot-master-deck-shell tarot-lounge-deck-shell ${modeMeta.accentClass}`}>
                  <div className="tarot-master-card-grid">
                    {deck.map((cardId, index) => {
                      const card = TAROT_CARDS[cardId];
                      const revealing = phase === 'revealing' && revealingCardId === cardId;

                      return (
                        <button
                          key={`${cardId}-${index}`}
                          type="button"
                          className={revealing ? `tarot-master-card ${modeMeta.accentClass} revealing` : `tarot-master-card ${modeMeta.accentClass}`}
                          style={{ ['--card-index' as string]: index } as CSSProperties}
                          onClick={() => handleCardPick(cardId)}
                          disabled={phase === 'revealing'}
                        >
                          <span className="tarot-master-card-glow" />
                          <span className="tarot-master-card-back">
                            <span className="tarot-master-card-back-shine" />
                            <span className="tarot-master-card-back-emblem" />
                          </span>
                          <span className="tarot-master-card-order">{index + 1}</span>

                          {revealing ? (
                            <>
                              <span className="tarot-master-card-emoji">{card.emoji}</span>
                              <strong className="tarot-master-card-label">{card.name}</strong>
                            </>
                          ) : (
                            <>
                              <span className="tarot-master-card-star">✦</span>
                              <strong className="tarot-master-card-label">{modeMeta.shortLabel}</strong>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {phase === 'revealing' && revealingCardId !== null ? (
                <section className={`tarot-master-portal ${modeMeta.accentClass}`}>
                  <div className="tarot-master-portal-rings" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="tarot-master-portal-badge">{TAROT_CARDS[revealingCardId].emoji}</div>
                  <strong>{TAROT_CARDS[revealingCardId].name} 카드가 열리고 있어요</strong>
                  <p>현재 선택한 카드의 해석과 흐름을 정리하고 있습니다.</p>
                </section>
              ) : null}
            </>
          ) : null}

          {phase === 'reading' && reading && selectedCard ? (
            <>
              <section className={`tarot-reading-cover ${modeMeta.accentClass}`}>
                <div>
                  <span className="mobile-chip">{modeMeta.label}</span>
                  <h2>{reading.title}</h2>
                  <p>{reading.tag}</p>
                </div>

                <button type="button" className="app-muted-button" onClick={handleRedraw}>
                  <RefreshCw size={15} />
                  다시 뽑기
                </button>
              </section>

              <section className="tarot-reading-selected-grid single">
                <article className={`tarot-reading-selected-card featured ${modeMeta.accentClass}`}>
                  <span className="tarot-reading-selected-badge">선택 카드</span>
                  <div className="tarot-reading-selected-copy">
                    <strong>{selectedCard.name}</strong>
                    <small>{modeMeta.shortLabel}의 중심 에너지</small>
                  </div>
                  <p>{selectedCard.emoji}</p>
                </article>
              </section>

              <section className="tarot-reading-summary">
                <strong>리딩 요약</strong>
                <p>{summaryLead}</p>
              </section>

              <section className="tarot-mission-card">
                <div className="tarot-mission-copy">
                  <span className="mobile-chip">MISSION TAROT</span>
                  <strong>오늘의 타로 미션</strong>
                  <p>하루 1회 미션을 완료하면 별 70개가 적립됩니다. 적립한 별은 상세 리딩 해제에 바로 사용할 수 있어요.</p>
                  <div className="tarot-mission-status">
                    <span>현재 별 {wallet.stars}개</span>
                    <span>{missionDoneToday ? '오늘 미션 완료' : '오늘 미션 미완료'}</span>
                  </div>
                </div>

                <button type="button" className="app-black-button" onClick={handleClaimMission} disabled={missionDoneToday}>
                  {missionDoneToday ? '오늘 미션 완료됨' : '미션 완료하고 별 70개 받기'}
                </button>
              </section>

              <section className="tarot-reading-panels">
                {freeSections.map((section) => (
                  <article key={section.key} className="tarot-reading-panel" style={{ ['--panel-index' as string]: section.index } as CSSProperties}>
                    <div className="tarot-reading-panel-head">
                      <span className="tarot-reading-panel-number">{section.index + 1}</span>
                      <div>
                        <strong>
                          {section.icon} {section.label}
                        </strong>
                        <small>무료 미리보기</small>
                      </div>
                    </div>
                    <p>{section.content}</p>
                  </article>
                ))}
              </section>

              <section className={isUnlocked ? 'tarot-reading-lock-wrap unlocked' : isUnlocking ? 'tarot-reading-lock-wrap unlocking' : 'tarot-reading-lock-wrap locked'}>
                <div className="tarot-reading-lock-body">
                  <div className="tarot-reading-panels">
                    {lockedSections.map((section) => (
                      <article key={section.key} className="tarot-reading-panel premium" style={{ ['--panel-index' as string]: section.index } as CSSProperties}>
                        <div className="tarot-reading-panel-head">
                          <span className="tarot-reading-panel-number">{section.index + 1}</span>
                          <div>
                            <strong>
                              {section.icon} {section.label}
                            </strong>
                            <small>프리미엄 리딩</small>
                          </div>
                        </div>
                        <p>{section.content}</p>
                      </article>
                    ))}
                  </div>
                </div>

                {!isUnlocked ? (
                  <div className="tarot-reading-lock-card">
                    <div className="tarot-reading-lock-card-inner">
                      <span className="tarot-reading-lock-icon">
                        <Lock size={22} />
                      </span>
                      <strong>{isUnlocking ? '봉인이 풀리는 중...' : '상세 리딩이 잠겨 있어요'}</strong>
                      <p>
                        {isUnlocking
                          ? '선택한 카드의 깊은 리딩과 타이밍, 조언 섹션을 순서대로 열고 있습니다.'
                          : '파일에 들어 있는 전체 타로 문구는 이미 연결되어 있습니다. 행운권 또는 별로 즉시 상세 리딩을 열 수 있습니다.'}
                      </p>
                      <div className="tarot-reading-lock-actions">
                        <button type="button" className="app-black-button" onClick={handleUnlockWithTicket} disabled={isUnlocking}>
                          <Ticket size={16} />
                          {isUnlocking ? '리딩 펼치는 중...' : '행운권 1장으로 펼치기'}
                        </button>
                        <button type="button" className="app-muted-button" onClick={handleUnlockWithStars} disabled={isUnlocking}>
                          <Eye size={16} />
                          별 10개로 펼치기
                        </button>
                      </div>
                      <small className="tarot-reading-lock-wallet">
                        보유 행운권 {wallet.luckTickets}장 · 보유 별 {wallet.stars}개
                      </small>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="tarot-reading-footer">
                <button type="button" className="app-black-button" onClick={handleRedraw}>
                  새로운 카드 다시 뽑기
                </button>
                <button type="button" className="app-muted-button" onClick={handleResetAll}>
                  주제 다시 선택하기
                </button>
              </section>
            </>
          ) : null}

          {feedback ? <div className="tarot-master-toast">{feedback}</div> : null}
        </section>
      </div>
    </main>
  );
}
