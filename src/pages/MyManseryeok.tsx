import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import MyAuthGate from '../features/my/MyAuthGate';
import { buildManseryeokChart, resolveManseryeokSource } from '../features/my/manseryeok';
import '../styles/my.css';

/**
 * 내 만세력.
 *
 * 서버를 부르지 않는다. 이미 저장된 출생정보로 원국을 세우는 것뿐이라, 새로 받거나
 * 보내는 정보가 없다. 없는 값을 채우지 않는 것이 이 화면의 규칙이다 — 출생시간이
 * 미상이면 시주 자리를 비워 두고, 왜 비었는지 적는다.
 */
function ManseryeokView() {
  const { user } = useAuth();
  const resolved = useMemo(() => resolveManseryeokSource(user?.id), [user?.id]);
  const chart = useMemo(() => buildManseryeokChart(resolved?.formData), [resolved]);

  if (!chart) {
    return (
      <main className="my-replay-page">
        <MobileTopBar title="내 만세력" backTo="/my" backLabel="마이" />
        <section className="my-manse-empty">
          <span className="my-gate-eyebrow">NO BIRTH DATA</span>
          <h1>아직 세울 원국이 없습니다</h1>
          <p>
            만세력은 출생정보에서 그대로 계산됩니다.
            <br />
            사주 리포트를 한 번 받으시면 그 입력으로 바로 세워 드립니다.
          </p>
          <Link to="/detail/general-saju" className="my-manse-cta">
            종합사주 보러가기
          </Link>
        </section>
      </main>
    );
  }

  const strengthPercent = Math.round(chart.strength.ratio * 100);

  return (
    <main className="my-replay-page">
      <MobileTopBar title="내 만세력" backTo="/my" backLabel="마이" />

      <section className="my-replay-content my-manse">
        <div className="my-replay-title">
          <span>MY NATAL CHART</span>
          <h1>{chart.name}님의 원국</h1>
          <p>
            {resolved?.source === 'archive'
              ? '보관함에 있는 리포트의 출생정보로 세웠습니다.'
              : '이 브라우저에 남은 최근 입력으로 세웠습니다.'}
          </p>
        </div>

        <section className="my-manse-pillars" aria-label="사주 네 기둥">
          {chart.pillars.map((pillar) => (
            <article key={pillar.position} className="my-manse-pillar">
              <span className="my-manse-pillar-label">{pillar.label}</span>
              <strong className="my-manse-stem">{pillar.stem}</strong>
              <strong className="my-manse-branch">{pillar.branch}</strong>
            </article>
          ))}
          {chart.hourKnown ? null : (
            /* 빈 자리를 자시로 채우면 모른다고 한 것을 아는 척하게 된다. 비워 두고 말한다. */
            <article className="my-manse-pillar is-unknown">
              <span className="my-manse-pillar-label">시주</span>
              <strong className="my-manse-unknown">미상</strong>
            </article>
          )}
        </section>

        {chart.hourKnown ? null : (
          <p className="my-manse-note">
            출생시간이 미상이라 시주를 세우지 않았습니다. 시주를 뺀 세 기둥만으로 읽습니다.
          </p>
        )}

        <section className="my-manse-card">
          <span className="my-manse-card-label">일간</span>
          <strong className="my-manse-daymaster">{chart.dayMaster.stem}</strong>
          <ul className="my-manse-keywords">
            {chart.dayMaster.keywords.map((keyword) => (
              <li key={keyword}>{keyword}</li>
            ))}
          </ul>
          <p>{chart.dayMaster.description}</p>
        </section>

        <section className="my-manse-card">
          <span className="my-manse-card-label">일간의 힘</span>
          <strong className="my-manse-strength-label">{chart.strength.label}</strong>
          <div
            className="my-manse-gauge"
            role="img"
            aria-label={`일간을 돕는 기운의 비중 ${strengthPercent}퍼센트, ${chart.strength.label}`}
          >
            <span style={{ width: `${strengthPercent}%` }} />
          </div>
          <p>일간을 돕는 기운이 원국 전체에서 차지하는 비중입니다.</p>
        </section>

        <section className="my-manse-basis">
          <dl>
            <div>
              <dt>띠</dt>
              <dd>{chart.zodiac}</dd>
            </div>
            <div>
              <dt>양력 환산</dt>
              <dd>{chart.basis.solarDate}</dd>
            </div>
            {chart.basis.lunarInput ? (
              <div>
                <dt>음력 입력</dt>
                <dd>{chart.basis.lunarInput}</dd>
              </div>
            ) : null}
            <div>
              <dt>입춘 기준</dt>
              <dd>{chart.basis.afterIpchun ? '입춘 이후' : '입춘 이전'}</dd>
            </div>
          </dl>
          <p>
            연주는 입춘을 해의 경계로 삼아 세웁니다. 만세력을 다른 곳과 맞춰 보실 때 이
            기준을 함께 보셔야 합니다.
          </p>
        </section>
      </section>
    </main>
  );
}

export default function MyManseryeok() {
  return (
    <MyAuthGate title="내 만세력" returnTo="/my/manseryeok">
      <ManseryeokView />
    </MyAuthGate>
  );
}
