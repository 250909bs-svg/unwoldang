import { useEffect, useMemo, useState } from 'react';
import { PAST_LIFE_PRODUCT } from '../content/pastLifeExperience';
import type { PastLifePortrait, PastLifeProfile, SajuReportData } from '../lib/saju/report';
import { sanitizePastLifeNarrative } from '../products/past-life-goblin/contentSafety';
import {
  buildPastLifeWebtoonViewModel,
  type PastLifeWebtoonPanelViewModel,
  type PastLifeWebtoonVolumeViewModel
} from '../products/past-life-goblin/webtoonViewModel';
import '../styles/past-life-webtoon.css';

type PastLifeStoryReportProps = {
  report: SajuReportData;
  profile: PastLifeProfile;
};

const RELEASE_MISSION_IDS = ['pause', 'name', 'boundary', 'record'] as const;
type ReleaseMissionId = (typeof RELEASE_MISSION_IDS)[number];

function readReleaseMissionState(storageKey: string): ReleaseMissionId[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as unknown;
    if (!Array.isArray(stored)) return [];
    return stored.filter(
      (value): value is ReleaseMissionId =>
        typeof value === 'string' && RELEASE_MISSION_IDS.includes(value as ReleaseMissionId)
    );
  } catch {
    return [];
  }
}

function CharacterPanel({ portrait, label }: { portrait: PastLifePortrait; label: string }) {
  return (
    <figure className="past-life-webtoon__character-panel">
      <img
        src={portrait.image}
        alt={portrait.imageAlt}
        width={1086}
        height={1448}
        loading="lazy"
        decoding="async"
      />
      <figcaption>
        <span>{label}</span>
        <h3>{portrait.title}</h3>
        <p>{portrait.role}</p>
        <small>{portrait.caption}</small>
      </figcaption>
    </figure>
  );
}

function WebtoonPanel({
  panel,
  episodeOrder
}: {
  panel: PastLifeWebtoonPanelViewModel;
  episodeOrder: number;
}) {
  return (
    <>
      <figure className="past-life-webtoon__panel" data-panel={panel.id}>
        <picture>
          <source srcSet={panel.artwork.avifSrc} type="image/avif" />
          <source srcSet={panel.artwork.src} type="image/webp" />
          <img
            src={panel.artwork.src}
            alt={panel.artwork.alt}
            width={panel.artwork.width}
            height={panel.artwork.height}
            loading="lazy"
            decoding="async"
          />
        </picture>
        <span className="past-life-webtoon__symbolic-label">상징 장면 · 실제 전생 기록 아님</span>
        <blockquote
          className={`past-life-webtoon__bubble past-life-webtoon__bubble--${panel.dialogue.side}`}
          data-speaker="goblin"
        >
          “{panel.dialogue.line}”
        </blockquote>
        <figcaption className="past-life-webtoon__narration">
          <strong>SCENE {String(episodeOrder).padStart(2, '0')}-{panel.order}</strong>
          {panel.narration}
        </figcaption>
      </figure>

      <details className="past-life-webtoon__topics">
        <summary>
          장부 원문 {panel.topics.length}개 펼쳐보기
        </summary>
        <div className="past-life-webtoon__topic-list">
          {panel.topics.map((topic) => (
            <article key={topic.number} className="past-life-webtoon__topic">
              <span>{String(topic.number).padStart(2, '0')}</span>
              <h3>{topic.title}</h3>
              {topic.content.split(/\n{2,}/u).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
          ))}
        </div>
      </details>
    </>
  );
}

function EvidenceDisclosure({ volume }: { volume: PastLifeWebtoonVolumeViewModel }) {
  return (
    <details className="past-life-webtoon__evidence">
      <summary>명리·현실 근거 5단계 펼쳐보기</summary>
      <ol>
        {volume.readingSteps.map((step) => (
          <li key={step.id}>
            <strong>{step.label}</strong>
            {step.value}
          </li>
        ))}
      </ol>
      <div className="past-life-webtoon__evidence-sources">
        {volume.evidence.map((evidence) => (
          <article key={evidence.id}>
            <strong>{evidence.label}</strong>
            <span>{evidence.value}</span>
            <p>{evidence.description}</p>
            {evidence.uncertainty ? <small>{evidence.uncertainty}</small> : null}
          </article>
        ))}
      </div>
    </details>
  );
}

function PersonalQuestionPanels({ report }: { report: SajuReportData }) {
  const answers = report.questionAnswers.slice(0, 2);
  if (answers.length === 0) return null;

  return (
    <div className="past-life-webtoon__questions" aria-label="내가 적은 질문을 장부 안에서 다시 읽기">
      {answers.map((answer, index) => (
        <article key={`${answer.question}-${index}`} className="past-life-webtoon__question">
          <span>내가 남긴 질문 {index + 1}</span>
          <blockquote>“{answer.question}”</blockquote>
          <p>{sanitizePastLifeNarrative(answer.analysis)}</p>
          {answer.advice[0] ? <strong>{sanitizePastLifeNarrative(answer.advice[0])}</strong> : null}
        </article>
      ))}
    </div>
  );
}

function ReleaseMission({ report, profile }: PastLifeStoryReportProps) {
  const storageKey = `unwoldang:past-life-release:${report.serialNumber}`;
  const missions = useMemo(
    () => [
      {
        id: 'pause' as const,
        label: '1주차 · 바로 답하지 않기',
        text: `“${profile.repeatedScene}”와 비슷한 장면이 오면 10분 뒤 답하고, 맡을 범위를 먼저 확인합니다.`
      },
      {
        id: 'name' as const,
        label: '2주차 · 감정에 이름 붙이기',
        text: `참기 전에 지금 감정을 “${profile.frequentEmotion}”이라고 한 문장으로 적습니다.`
      },
      {
        id: 'boundary' as const,
        label: '3주차 · 경계를 먼저 말하기',
        text: '할 수 있는 범위, 끝나는 날짜, 필요한 대가 중 하나를 부탁보다 먼저 말합니다.'
      },
      {
        id: 'record' as const,
        label: '4주차 · 달라진 증거 남기기',
        text: `“${profile.hiddenDesire}”에 가까워진 작은 선택을 일주일에 한 줄씩 남깁니다.`
      }
    ],
    [profile.frequentEmotion, profile.hiddenDesire, profile.repeatedScene]
  );
  const [completed, setCompleted] = useState<ReleaseMissionId[]>(() =>
    readReleaseMissionState(storageKey)
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(completed));
    } catch {
      // Storage is optional; the checklist remains usable in memory.
    }
  }, [completed, storageKey]);

  const toggleMission = (id: ReleaseMissionId) => {
    setCompleted((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <section className="past-life-webtoon__mission" id="past-life-release-mission">
      <span>30일 해원록 · 현생 행동</span>
      <h2>과거를 고치는 대신, 다음 선택의 순서를 바꿉니다</h2>
      <p>
        체크 상태에는 개인 문장·이름·생년월일을 저장하지 않고, 완료한 미션 ID와 익명 리포트 식별자만 이 기기에 보관합니다.
      </p>
      <progress value={completed.length} max={missions.length} aria-label="30일 해원 미션 진행률" />
      <p className="past-life-webtoon__mission-status" role="status" aria-live="polite">
        {completed.length}/{missions.length} 완료
      </p>
      <fieldset>
        <legend>이번 달에 확인할 네 가지 행동</legend>
        {missions.map((mission) => (
          <label key={mission.id}>
            <input
              type="checkbox"
              checked={completed.includes(mission.id)}
              onChange={() => toggleMission(mission.id)}
            />
            <span>
              <strong>{mission.label}</strong>
              <small>{mission.text}</small>
            </span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}

function WebtoonEpisode({
  volume,
  report,
  nextVolume
}: {
  volume: PastLifeWebtoonVolumeViewModel;
  report: SajuReportData;
  nextVolume?: PastLifeWebtoonVolumeViewModel;
}) {
  return (
    <section
      className={`past-life-webtoon__episode${volume.isFocused ? ' is-focus' : ''}`}
      id={volume.sectionId}
      data-volume={volume.id}
    >
      <header className="past-life-webtoon__episode-title" data-seal={volume.symbol}>
        {volume.isFocused ? (
          <span className="past-life-webtoon__focus-badge">내가 고른 핵심 장부 · {volume.title}</span>
        ) : null}
        <span>{volume.volume} · EPISODE {String(volume.order).padStart(2, '0')}</span>
        <h2>{volume.title}</h2>
        <p>{volume.line}</p>
      </header>

      {volume.panels.map((panel) => (
        <div key={panel.id} className="past-life-webtoon__panel-group">
          <WebtoonPanel panel={panel} episodeOrder={volume.order} />
          {panel.order === 2 ? (
            <aside className="past-life-webtoon__interlude">
              <p>{volume.readingSteps.find((step) => step.id === 'other-possibility')?.value}</p>
            </aside>
          ) : null}
        </div>
      ))}

      {volume.isFocused ? <PersonalQuestionPanels report={report} /> : null}
      <EvidenceDisclosure volume={volume} />
      <footer className="past-life-webtoon__bridge">
        <span>다음 장으로 이어지는 실</span>
        <p>{volume.readingSteps.find((step) => step.id === 'today-action')?.value}</p>
        <a href={nextVolume ? `#${nextVolume.sectionId}` : '#past-life-release-mission'}>
          {nextVolume ? `다음 장부 · ${nextVolume.title}` : '30일 해원 미션으로 이동'}
        </a>
      </footer>
    </section>
  );
}

export default function PastLifeStoryReport({ report, profile }: PastLifeStoryReportProps) {
  const viewModel = useMemo(
    () => buildPastLifeWebtoonViewModel(report, profile),
    [profile, report]
  );

  return (
    <article className="past-life-webtoon" aria-labelledby="past-life-webtoon-title">
      <section className="past-life-webtoon__prologue" id="pastlife-prologue">
        <picture>
          <img
            src="/media/dokkaebi-guide-poster.webp"
            alt="도깨비 장부지기가 검은 장부를 열며 상징 서사의 시작을 알리는 장면"
            width={1080}
            height={1440}
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
        </picture>
        <div className="past-life-webtoon__prologue-copy">
          <span className="past-life-webtoon__eyebrow">PROLOGUE · 이름이 지워진 장부</span>
          <h2 id="past-life-webtoon-title">{viewModel.openingLine}</h2>
          <blockquote>“이건 과거를 증명하는 기록이 아니야. 네가 반복해 온 선택을 장면으로 보여줄게.”</blockquote>
          <p>{viewModel.notice}</p>
        </div>
      </section>

      <section className="past-life-webtoon__docket" aria-labelledby="past-life-docket-title">
        <span className="past-life-webtoon__eyebrow">PERSONAL LEDGER · 개인 장부 접수표</span>
        <h2 id="past-life-docket-title">내가 남긴 답과 사주 근거가 어느 장면에 쓰였는지 먼저 확인합니다</h2>
        <p>{viewModel.subtitle}</p>
        <dl className="past-life-webtoon__docket-grid">
          <div>
            <dt>선택한 주제</dt>
            <dd>{viewModel.focus.label}</dd>
          </div>
          <div>
            <dt>상징 봉인명</dt>
            <dd>{profile.sealName}</dd>
          </div>
          <div>
            <dt>반복 감정</dt>
            <dd>{profile.frequentEmotion}</dd>
          </div>
          <div>
            <dt>출생시간 근거</dt>
            <dd>{viewModel.birthTimeKnown ? '시주 포함' : '시주 제외'}</dd>
          </div>
        </dl>
        {viewModel.limitation ? <p role="note">{viewModel.limitation}</p> : null}
        <div className="past-life-webtoon__docket-evidence" aria-label="이야기에 반영한 근거">
          {profile.evidence.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="past-life-webtoon__characters" aria-labelledby="past-life-characters-title">
        <header>
          <span>CHARACTER REVEAL · 상징 인물</span>
          <h2 id="past-life-characters-title">이야기의 나와 가장 깊게 얽힌 관계</h2>
          <p>특정 실존 인물을 지목하지 않는 창작 초상이며, 사주 기질과 직접 남긴 답을 시각화했습니다.</p>
        </header>
        <CharacterPanel portrait={profile.selfPortrait} label="상징 서사의 나" />
        <CharacterPanel portrait={profile.connectionPortrait} label="가장 깊게 얽힌 관계" />
      </section>

      {viewModel.volumes.map((volume, index) => (
        <WebtoonEpisode
          key={volume.id}
          volume={volume}
          report={report}
          nextVolume={viewModel.volumes[index + 1]}
        />
      ))}

      <ReleaseMission key={report.serialNumber} report={report} profile={profile} />

      <section className="past-life-webtoon__epilogue" aria-labelledby="past-life-epilogue-title">
        <img
          src={PAST_LIFE_PRODUCT.guideAvatar}
          alt=""
          width={512}
          height={512}
          loading="lazy"
          decoding="async"
        />
        <span className="past-life-webtoon__eyebrow">EPILOGUE · 마지막 줄은 현재형</span>
        <h2 id="past-life-epilogue-title">“바꿔야 할 건 과거가 아니라 다음 선택이야.”</h2>
        <p>{viewModel.disclaimer}</p>
        <a href="#summary">내가 지킬 한 문장과 전체 결론 보기</a>
      </section>
    </article>
  );
}
