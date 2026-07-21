import { Fragment } from 'react';
import { PAST_LIFE_PRODUCT, PAST_LIFE_REPORT_VOLUMES, pastLifeChapters } from '../content/pastLifeExperience';
import type { PastLifePortrait, PastLifeProfile, ReportSection, SajuReportData } from '../lib/saju/report';

type PastLifeStoryReportProps = {
  report: SajuReportData;
  profile: PastLifeProfile;
};

const chapterSectionIds = PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.sectionId);

const chapterGuideOpenings = [
  '첫 권은 네가 누구였다는 사실보다, 사주에 어떤 역할의 기질이 반복되는지 보여줘.',
  '이 인연을 운명이라 부르진 않을게. 다만 네 선택이 가장 크게 흔들린 관계야.',
  '업은 벌이 아니야. 끝내지 않은 선택이 같은 모양으로 돌아오는 거지.',
  '낯익은 장면이 있으면 표시해 둬. 사람은 달라도 선택의 순서는 반복될 수 있으니까.',
  '봉인은 기억을 되찾는다고 풀리지 않아. 오늘 한 번 다르게 답할 때 풀려.'
] as const;

const chapterGuideInterjections = [
  '여기서 잘한 일만 보지 마. 네가 끝까지 혼자 감춘 것도 같이 봐.',
  '끌림보다 중요한 건, 두 사람이 약속을 어떻게 지켰는지야.',
  '익숙한 아픔을 운명으로 부르면 선택할 힘이 사라져.',
  '지금 떠오른 장면 하나면 충분해. 그게 현생의 입구야.',
  '이번엔 알아차리는 데서 끝내지 말고, 한 문장으로 행동해.'
] as const;

const chapterBridgeLines = [
  '역할은 확인했어. 이제 그 역할보다 먼저 너를 알아본 사람을 보자.',
  '둘을 멀어지게 한 건 저주가 아니야. 미뤄둔 한마디가 다음 권에 남아 있어.',
  '과거의 장면은 여기까지. 이제 그 선택이 오늘 어디에 남았는지 보자.',
  '원인을 알았으니, 다음은 예언이 아니라 선택이야.',
  '큰 결심은 필요 없어. 아래에서 네가 지킬 한 문장만 고르자.'
] as const;

function PortraitCard({ portrait, tone }: { portrait: PastLifePortrait; tone: 'self' | 'connection' }) {
  return (
    <article className={`past-life-portrait-card ${tone}`}>
      <div className="past-life-portrait-frame">
        <img src={portrait.image} alt={portrait.imageAlt} loading="lazy" decoding="async" />
        <span className="past-life-portrait-vignette" aria-hidden="true" />
        <span className="past-life-portrait-mark">象</span>
      </div>
      <div className="past-life-portrait-copy">
        <span>{portrait.eyebrow}</span>
        <h3>{portrait.title}</h3>
        <p>{portrait.role}</p>
        <dl>
          <div>
            <dt>얼굴과 인상</dt>
            <dd>{portrait.appearance.join(' · ')}</dd>
          </div>
          <div>
            <dt>옷차림</dt>
            <dd>{portrait.attire}</dd>
          </div>
          <div>
            <dt>눈빛</dt>
            <dd>{portrait.gaze}</dd>
          </div>
        </dl>
        <small>{portrait.caption}</small>
      </div>
    </article>
  );
}

function chapterPersonalRecord(index: number, profile: PastLifeProfile) {
  if (index === 0) {
    return [
      { label: '상징 봉인명', value: profile.sealName },
      { label: '상징 무대', value: profile.place },
      { label: '상징 역할', value: profile.vocation },
      { label: '상징 물건', value: profile.keepsake }
    ];
  }

  if (index === 1) {
    return [
      { label: '관계 캐릭터', value: profile.connectionRole },
      { label: '인연의 온도', value: '설렘보다 신뢰가 먼저였고, 서로의 피로를 말없이 알아보던 관계' },
      { label: '약속의 빈틈', value: '서로가 맡을 책임의 범위와 돌아올 시점을 끝내 정하지 못한 관계' }
    ];
  }

  if (index === 2) {
    return [
      { label: '상징 서사의 마지막 장면', value: profile.finalSeparation },
      { label: '끝내 못 한 말', value: `숨겨 온 감정을 “${profile.frequentEmotion}”이라고 이름 붙여 털어놓는 일` },
      { label: '업의 정체', value: '초자연적 벌이 아니라, 책임의 끝을 말하지 못한 반복 선택' }
    ];
  }

  if (index === 3) {
    return [
      { label: '현생 반복 장면', value: profile.repeatedScene },
      { label: '자주 드는 감정', value: profile.frequentEmotion },
      { label: '숨겨둔 바람', value: profile.hiddenDesire }
    ];
  }

  return [
    { label: '첫 해원', value: '부탁에 즉답하지 않고, 내가 할 수 있는 범위와 끝나는 날을 먼저 말하기' },
    { label: '관계 기준', value: '강한 끌림보다 반복되는 약속 이행과 갈등 뒤 회복 행동 보기' },
    { label: '30일 증거', value: '이전과 다르게 선택한 장면을 매주 한 줄씩 남기기' }
  ];
}

function chapterBridgeLine(index: number) {
  return chapterBridgeLines[index];
}

function StoryChapter({
  index,
  section,
  profile
}: {
  index: number;
  section: ReportSection;
  profile: PastLifeProfile;
}) {
  const chapter = pastLifeChapters[index];
  const beat = profile.storyBeats[index];
  const records = chapterPersonalRecord(index, profile);

  return (
    <section className="past-life-story-chapter" id={section.id} data-chapter={chapter.id}>
      <div className="past-life-story-chapter-art">
        <img
          src={chapter.image}
          alt={chapter.imageAlt}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: chapter.crop }}
        />
        <div className="past-life-story-art-shade" aria-hidden="true" />
        <div className="past-life-story-chapter-title">
          <span>{chapter.volume}</span>
          <h2>{chapter.title}</h2>
          <p>{chapter.line}</p>
        </div>
      </div>

      <div className="past-life-story-chapter-body">
        <div className="past-life-goblin-dialogue">
          <span className="past-life-goblin-avatar" aria-hidden="true">
            <img src={PAST_LIFE_PRODUCT.guideAvatar} alt="" loading="lazy" />
          </span>
          <div>
            <small>도깨비 장부지기의 말</small>
            <p>“{chapterGuideOpenings[index]}”</p>
            <p className="past-life-dialogue-followup">{beat.goblinLine}</p>
          </div>
        </div>

        <header className="past-life-story-scene">
          <span>SCENE {String(index + 1).padStart(2, '0')}</span>
          <h3>{beat.title}</h3>
          <p>{beat.scene}</p>
          <strong>{beat.presentEcho}</strong>
        </header>

        <div className="past-life-personal-records">
          {records.map((record) => (
            <article key={record.label}>
              <span>{record.label}</span>
              <p>{record.value}</p>
            </article>
          ))}
        </div>

        <div className="past-life-story-pages">
          {section.details?.map((detail, detailIndex) => (
            <Fragment key={detail.summary}>
              <article className="past-life-story-page">
                <div className="past-life-story-page-number">
                  {String(
                    PAST_LIFE_REPORT_VOLUMES
                      .slice(0, index)
                      .reduce((total, volume) => total + volume.topics.length, 0) +
                      detailIndex +
                      1
                  ).padStart(2, '0')}
                </div>
                <div>
                  <h4>{detail.summary.replace(/^\d{2}\.\s*/, '')}</h4>
                  {detail.content.split(/\n{2,}/).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
              {detailIndex === 1 ? (
                <aside className="past-life-guide-interjection">
                  <span className="past-life-goblin-avatar" aria-hidden="true">
                    <img src={PAST_LIFE_PRODUCT.guideAvatar} alt="" loading="lazy" />
                  </span>
                  <div>
                    <small>잠깐, 여기서 장부를 덮지 마</small>
                    <p>“{chapterGuideInterjections[index]}”</p>
                  </div>
                </aside>
              ) : null}
            </Fragment>
          ))}
        </div>

        {section.callout ? (
          <aside className="past-life-story-callout">
            <span>封印 記錄</span>
            {section.callout.title ? <h4>{section.callout.title}</h4> : null}
            <p>{section.callout.body}</p>
          </aside>
        ) : null}

        <footer className="past-life-story-bridge">
          <span>다음 장으로 이어지는 실</span>
          <p>{chapterBridgeLine(index)}</p>
          {index < pastLifeChapters.length - 1 ? (
            <a href={`#${chapterSectionIds[index + 1]}`}>다음 장부 · {pastLifeChapters[index + 1].title}</a>
          ) : (
            <a href="#summary">봉인 해제 결론 보기</a>
          )}
        </footer>
      </div>
    </section>
  );
}

export default function PastLifeStoryReport({ report, profile }: PastLifeStoryReportProps) {
  const sections = PAST_LIFE_REPORT_VOLUMES.flatMap((volume, index) => {
    const section = report.sections.find((candidate) => candidate.id === volume.sectionId);
    return section ? [{ section, index }] : [];
  });

  return (
    <div className="past-life-story-report">
      <section className="past-life-story-prologue" id="pastlife-prologue">
        <div className="past-life-guide-prologue-visual">
          <img
            src={pastLifeChapters[0].image}
            alt="달빛 아래 상징 장부를 열어 보이며 말을 거는 도깨비 장부지기"
            loading="eager"
            decoding="async"
            fetchPriority="high"
          />
          <span className="past-life-story-art-shade" aria-hidden="true" />
          <div className="past-life-guide-prologue-dialogues" aria-label="도깨비 장부지기의 안내">
            <p>“먼저 약속할게. 이건 과거를 증명하는 기록이 아니야.”</p>
            <p>“네 사주와 네가 남긴 답을 한 편의 상징 서사로 엮었어.”</p>
            <p>“익숙한 장면이 있다면, 그 이유를 오늘의 선택에서 찾아보자.”</p>
          </div>
        </div>
        <div>
          <span>PROLOGUE · 이름이 지워진 장부</span>
          <h2>{profile.openingLine}</h2>
          <p>
            여기부터는 {report.customerName}님의 원국과 직접 남긴 답을 한 사람의 이야기로 이어 읽습니다.
            전생을 사실로 단정하는 기록이 아니라, 지금도 반복되는 선택을 눈앞의 장면처럼 알아보기 위한 상징 장부입니다.
          </p>
          <div className="past-life-story-evidence" aria-label="이야기에 반영한 근거">
            {profile.evidence.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="past-life-identity-ledger" id="pastlife-identity">
        <header>
          <span>CHARACTER LEDGER</span>
          <h2>상징 서사의 나와 가장 깊게 얽힌 관계</h2>
          <p>이야기의 중심이 되는 두 사람의 얼굴과 관계를 먼저 장부에 고정했습니다. 장별 삽화는 각 사건의 분위기를 상징적으로 보여줍니다.</p>
        </header>
        <div className="past-life-portrait-grid">
          <PortraitCard portrait={profile.selfPortrait} tone="self" />
          <PortraitCard portrait={profile.connectionPortrait} tone="connection" />
        </div>
        <div className="past-life-first-meeting">
          <span>두 사람의 첫 장면</span>
          <p>{profile.firstMeeting}</p>
          <strong>{profile.unfinishedPromise}</strong>
        </div>
        <p className="past-life-symbolic-notice">{profile.disclaimer}</p>
      </section>

      <div className="past-life-story-volume-list">
        {sections.map(({ section, index }) => (
          <StoryChapter key={section.id} index={index} section={section} profile={profile} />
        ))}
      </div>

      <section className="past-life-guide-ending" aria-labelledby="pastlife-guide-ending-title">
        <div className="past-life-guide-ending-art">
          <img
            src={pastLifeChapters[4].image}
            alt="새벽빛 문 앞에서 붉은 실을 풀어 돌려주는 도깨비 장부지기"
            loading="lazy"
          />
          <span className="past-life-guide-ending-shade" aria-hidden="true" />
        </div>
        <div className="past-life-guide-ending-dialogue">
          <span className="past-life-goblin-avatar" aria-hidden="true">
            <img src={PAST_LIFE_PRODUCT.guideAvatar} alt="" loading="lazy" />
          </span>
          <div>
            <small>도깨비 장부지기의 마지막 말</small>
            <h2 id="pastlife-guide-ending-title">“여기까지가 내가 읽은 장부야.”</h2>
            <p>{report.customerName}님, 바꿔야 할 건 과거가 아니라 다음 선택이야.</p>
            <p>같은 장면이 오면, 이번엔 한 문장만 먼저 말해. 그 순간부터 마지막 줄은 네가 쓰는 거야.</p>
            <a href="#summary">내가 지킬 한 문장 고르기</a>
          </div>
        </div>
      </section>
    </div>
  );
}
