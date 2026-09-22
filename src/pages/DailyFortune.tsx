import { CircleAlert, Link2, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import { buildDailyFortune, koreanDateKey } from '../features/daily/dailyFortune';
import MyAuthGate from '../features/my/MyAuthGate';
import { resolveManseryeokSource } from '../features/my/manseryeok';
import '../styles/my.css';
import '../styles/daily.css';

/**
 * 오늘의 운세.
 *
 * 만세력과 같은 자리에서 출생정보를 읽고, 같은 원칙으로 만든다 — 서버를 부르지 않고,
 * 점수를 지어내지 않고, 같은 날이면 몇 번을 열어도 같은 글이다.
 */
function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()];

  return `${month}월 ${day}일 ${weekday}요일`;
}

function DailyFortuneView() {
  const { user } = useAuth();
  const resolved = useMemo(() => resolveManseryeokSource(user?.id), [user?.id]);
  const dateKey = koreanDateKey();
  const fortune = useMemo(
    () => buildDailyFortune(resolved?.formData, dateKey),
    [resolved, dateKey]
  );

  if (!fortune) {
    return (
      <main className="my-replay-page">
        <MobileTopBar title="오늘의 운세" backTo="/my" backLabel="마이" />
        <section className="my-manse-empty">
          <span className="my-gate-eyebrow">NO BIRTH DATA</span>
          <h1>오늘을 읽을 원국이 없습니다</h1>
          <p>
            오늘의 운세는 내 원국과 오늘 일진을 맞대어 봅니다.
            <br />
            사주 리포트를 한 번 받으시면 그 입력으로 매일 열립니다.
          </p>
          <Link to="/detail/general-saju" className="my-manse-cta">
            종합사주 보러가기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="my-replay-page">
      <MobileTopBar title="오늘의 운세" backTo="/my" backLabel="마이" />

      <section className="my-replay-content ud-daily">
        <header className={`ud-daily-hero is-${fortune.tone}`}>
          <span className="ud-daily-date">{formatDateLabel(fortune.dateKey)}</span>
          <h1>{fortune.headline}</h1>
          <p className="ud-daily-pillar">
            오늘의 일진 <strong>{fortune.dayPillar.label}</strong>
            <em>
              {fortune.tenGod.stem} · {fortune.tenGod.branch}
            </em>
          </p>
        </header>

        <p className="ud-daily-summary">{fortune.summary}</p>

        <section className="ud-daily-areas" aria-label="오늘 건드려지는 영역">
          {fortune.areas.map((area) => (
            <article key={area.id} className={area.active ? 'ud-daily-area is-active' : 'ud-daily-area'}>
              <span className="ud-daily-area-label">
                {area.label}
                {area.active ? <i aria-label="오늘 활성화된 영역">오늘</i> : null}
              </span>
              <p>{area.statement}</p>
            </article>
          ))}
        </section>

        {/* 결론만 보여 주면 믿을 근거가 없다. 어떤 관계가 잡혔는지 그대로 펼친다. */}
        <section className="ud-daily-evidence">
          <div className="my-section-label">
            <Link2 size={15} />
            오늘 일진과 내 원국 사이
          </div>
          {fortune.relations.length ? (
            <ul>
              {fortune.relations.map((relation) => (
                <li key={`${relation.name}-${relation.sentence}`} data-polarity={relation.polarity}>
                  <strong>{relation.name}</strong>
                  <span>{relation.sentence}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ud-daily-none">뚜렷한 합·충이 잡히지 않았습니다. 오늘은 평소의 흐름입니다.</p>
          )}
          <p className="ud-daily-tally">
            통합 신호 {fortune.tally.integrative} · 마찰 신호 {fortune.tally.friction}
          </p>
        </section>

        {fortune.uncertainty.length ? (
          <section className="ud-daily-uncertainty">
            <CircleAlert size={14} aria-hidden="true" />
            <ul>
              {fortune.uncertainty.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <Link to="/my/manseryeok" className="ud-daily-more">
          <Sparkles size={15} aria-hidden="true" />
          내 원국 전체 보기
        </Link>

        <p className="ud-daily-disclaimer">
          오늘의 운세는 내 원국과 오늘 일진의 명리 관계를 정리한 것이며, 확정된 예언이
          아닙니다. 매일 0시(한국시간)에 바뀝니다.
        </p>
      </section>
    </main>
  );
}

export default function DailyFortune() {
  return (
    <MyAuthGate title="오늘의 운세" returnTo="/today">
      <DailyFortuneView />
    </MyAuthGate>
  );
}
