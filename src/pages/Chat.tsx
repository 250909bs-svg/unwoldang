import { RotateCcw, SendHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import {
  askUnwol,
  clearChatHistory,
  readChatHistory,
  writeChatHistory,
  type ChatFacts,
  type ChatTurn
} from '../features/chat/api';
import { buildManseryeokChart, resolveManseryeokSource } from '../features/my/manseryeok';
import MyAuthGate from '../features/my/MyAuthGate';
import '../styles/my.css';
import '../styles/chat.css';

/**
 * 운월 상담 채팅.
 *
 * 운월은 이 사람의 명식을 이미 알고 시작한다 — 만세력이 쓰는 것과 같은 출생정보를
 * 읽어 첫 인사에 원국을 짚는다. 상담이 "누구세요" 로 시작하지 않는 것이 이 화면의
 * 값어치다.
 */
const SUGGESTIONS = [
  '올해 제 흐름은 어떤가요?',
  '지금 이직을 생각해도 될 시기인가요?',
  '제 일간은 어떤 성향인가요?',
  '사람과 부딪힐 때 저는 어떤 편인가요?'
];

function ChatView() {
  const { user } = useAuth();
  const resolved = useMemo(() => resolveManseryeokSource(user?.id), [user?.id]);
  const chart = useMemo(() => buildManseryeokChart(resolved?.formData), [resolved]);
  const [turns, setTurns] = useState<ChatTurn[]>(() => readChatHistory(user?.id));
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    writeChatHistory(turns, user?.id);
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, user?.id]);

  const facts: ChatFacts | null = chart
    ? {
        name: chart.name,
        pillars: chart.pillars.map((pillar) => ({ position: pillar.label, label: `${pillar.stem}${pillar.branch}` })),
        hourKnown: chart.hourKnown,
        dayMaster: chart.dayMaster.stem,
        zodiac: chart.zodiac,
        strengthLabel: chart.strength.label
      }
    : null;

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy || !facts) return;

    if (!user?.authToken) {
      /* 조용히 아무 일도 안 하면 손님은 앱이 멈춘 줄 안다. 로컬 미리보기 계정처럼
         서버 토큰이 없는 경우가 실제로 있다. */
      setError('상담은 카카오 로그인 후에 열립니다. 로그인하시면 이어서 답해 드리겠습니다.');
      return;
    }

    const next: ChatTurn[] = [...turns, { role: 'user', text: message }];
    setTurns(next);
    setDraft('');
    setBusy(true);
    setError('');

    try {
      const answer = await askUnwol({ authToken: user.authToken, facts, history: next });
      setTurns([...next, { role: 'unwol', text: answer.reply, guard: answer.guard }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '운월이 답하지 못했습니다.');
      /* 보낸 말은 화면에 남긴다 — 다시 쓰게 만들지 않는다. */
    } finally {
      setBusy(false);
    }
  };

  if (!chart || !facts) {
    return (
      <main className="my-replay-page">
        <MobileTopBar title="채팅방" backTo="/my" backLabel="마이" />
        <section className="my-manse-empty">
          <span className="my-gate-eyebrow">NO BIRTH DATA</span>
          <h1>먼저 원국을 세워야 합니다</h1>
          <p>
            운월은 손님의 명식을 보고 답합니다.
            <br />
            사주 리포트를 한 번 받으시면 그 입력으로 상담이 열립니다.
          </p>
          <Link to="/detail/general-saju" className="my-manse-cta">
            종합사주 보러가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="my-replay-page ud-chat-page">
      <MobileTopBar
        title="채팅방"
        backTo="/my"
        backLabel="마이"
        rightSlot={
          turns.length ? (
            <button
              type="button"
              className="ud-chat-reset"
              onClick={() => {
                clearChatHistory(user?.id);
                setTurns([]);
                setError('');
              }}
            >
              <RotateCcw size={16} aria-hidden="true" />
              새 대화
            </button>
          ) : undefined
        }
      />

      <div className="ud-chat-scroll">
        {/* 첫 인사는 모델을 부르지 않는다. 명식은 이미 손에 있고, 인사 한 줄에
            토큰을 쓸 이유가 없다. */}
        <article className="ud-chat-bubble is-unwol">
          <span className="ud-chat-who">운월</span>
          <p>
            {chart.name}님, 오십니다. 일간 <b>{chart.dayMaster.stem}</b>에 {chart.strength.label}으로
            읽히는 원국이시군요.
            {chart.hourKnown ? '' : ' 출생시간이 미상이라 시주는 빼고 보겠습니다.'}
          </p>
          <p>무엇이 궁금하신지 편히 물어보세요.</p>
        </article>

        {turns.map((turn, index) => (
          <article
            key={`${index}-${turn.text.slice(0, 12)}`}
            className={`ud-chat-bubble is-${turn.role}${turn.guard ? ' is-guard' : ''}`}
          >
            {turn.role === 'unwol' ? <span className="ud-chat-who">운월</span> : null}
            {turn.text.split('\n').filter(Boolean).map((line, lineIndex) => (
              <p key={lineIndex}>{line}</p>
            ))}
          </article>
        ))}

        {busy ? (
          <article className="ud-chat-bubble is-unwol is-thinking" aria-live="polite">
            <span className="ud-chat-who">운월</span>
            <p>
              <i />
              <i />
              <i />
            </p>
          </article>
        ) : null}

        {error ? (
          <p className="ud-chat-error" role="alert">
            {error}
          </p>
        ) : null}

        {turns.length === 0 ? (
          <div className="ud-chat-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => void send(suggestion)}>
                <Sparkles size={13} aria-hidden="true" />
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <p className="ud-chat-disclaimer">
          운월은 손님의 명식을 근거로 답합니다. 확정된 예언이 아니며, 건강·법률·투자
          판단은 드리지 않습니다. 대화는 이 브라우저에만 남고 서버에 저장되지 않습니다.
        </p>

        <div ref={endRef} />
      </div>

      <form
        className="ud-chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="운월에게 물어보세요"
          maxLength={500}
          aria-label="운월에게 보낼 말"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !draft.trim()} aria-label="보내기">
          <SendHorizontal size={18} />
        </button>
      </form>

    </main>
  );
}

export default function Chat() {
  return (
    <MyAuthGate title="채팅방" returnTo="/chat">
      <ChatView />
    </MyAuthGate>
  );
}
