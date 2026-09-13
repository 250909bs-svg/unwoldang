import type { IntakeFormData } from '../../api/mockData';
import type { ReportSection, SajuReportData } from '../../lib/saju/report';
import './generalSignatureReport.css';

const STEM_HANJA: Record<string, string> = {
  갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸'
};
const BRANCH_HANJA: Record<string, string> = {
  자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳', 오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥'
};

type BriefingItem = {
  label: string;
  body: string;
  anchor: string;
};

function toHanja(value: string) {
  const [stem, branch, ...rest] = Array.from(value);
  return `${STEM_HANJA[stem] || stem || ''}${BRANCH_HANJA[branch] || branch || ''}${rest.join('')}`;
}

function findSection(report: SajuReportData, keywords: string[]): ReportSection | undefined {
  return report.sections.find((section) => {
    const haystack = `${section.id} ${section.title}`.toLowerCase();
    return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
}

function compactInsight(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  const sentence = normalized.slice(0, maxLength).replace(/\s+\S*$/, '').trim();
  return `${sentence}…`;
}

function firstSectionInsight(section: ReportSection | undefined, fallback: string) {
  return compactInsight(
    section?.callout?.body || section?.cards?.[0]?.body || section?.paragraphs?.[0] || section?.bullets?.[0] || fallback
  );
}

function getTimePrecision(input: Partial<IntakeFormData>, report: SajuReportData) {
  if (input.isUnknownTime || report.engineMeta?.calculationPrecision === 'unknown') return 'unknown';
  if (input.birthTimePrecision === 'branch-range' || report.engineMeta?.calculationPrecision === 'legacy-range') return 'range';
  return 'exact';
}

function buildBriefing(report: SajuReportData): BriefingItem[] {
  const hasConfirmedYongsin = report.engineMeta?.yongsinConsensusStatus === 'confirmed';
  const wealth = findSection(report, ['wealth', '재물', '돈']);
  const cautionText = report.cautiousElements.length
    ? `${report.cautiousElements.join('·')} 흐름이 과해지는 순간에는 결정의 범위와 책임을 먼저 확인해야 합니다.`
    : '빠른 결론보다 일정·비용·관계의 조건을 하나씩 확인해야 합니다.';
  const balanceText = hasConfirmedYongsin && report.helpfulElements.length
    ? `${report.helpfulElements.join('·')} 기운을 현재 선택과 생활 리듬에 연결해 활용합니다.`
    : `${report.strengthLabel} 판정과 월령·대운을 함께 놓고 균형을 확인합니다.`;

  return [
    {
      label: '타고난 중심',
      body: compactInsight(`${report.pillars.day} 일주와 ${report.pillars.month} 월령을 중심으로 읽습니다. ${report.heroNote}`),
      anchor: 'glance'
    },
    {
      label: '현재 대운',
      body: compactInsight(`${report.currentDayun.name} 대운 · ${report.currentDayun.summary}`),
      anchor: 'fortune'
    },
    {
      label: hasConfirmedYongsin ? '용희의 핵심' : '균형의 핵심',
      body: compactInsight(balanceText),
      anchor: 'glance'
    },
    {
      label: '가장 중요한 주의점',
      body: compactInsight(cautionText),
      anchor: 'summary'
    },
    {
      label: '재물의 핵심',
      body: firstSectionInsight(wealth, '수입의 크기보다 계약 범위와 정산 기준을 먼저 세우는 일이 중요합니다.'),
      anchor: wealth?.id || 'summary'
    },
    {
      label: '종합 조언',
      body: compactInsight(report.actionPlan.priorities[0] || report.keyTakeaways[0]?.body || report.heroNote),
      anchor: 'plan'
    }
  ];
}

function getCalendarLabel(input: Partial<IntakeFormData>) {
  if (input.calendar !== 'lunar') return '양력';
  return input.isLeapMonth ? '음력 · 윤달' : '음력 · 평달';
}

function getGenderLabel(input: Partial<IntakeFormData>) {
  if (input.gender === 'male') return '남성';
  if (input.gender === 'female') return '여성';
  return '미입력';
}

export default function GeneralSignatureReportIntro({
  report,
  input
}: {
  report: SajuReportData;
  input: Partial<IntakeFormData>;
}) {
  const precision = getTimePrecision(input, report);
  const briefing = buildBriefing(report);
  const currentYear = report.yearLuck[0];
  const nextYear = report.yearLuck[1];
  const important = report.keyTakeaways.slice(0, 3);
  const pillarSignature = [report.pillars.year, report.pillars.month, report.pillars.day, report.pillars.hour]
    .filter((pillar): pillar is string => Boolean(pillar))
    .map(toHanja)
    .join(' · ');
  const coverFacts = [
    ['이름', report.customerName],
    ['생년월일', input.birthDate || report.birthLabel],
    ['출생시간', input.isUnknownTime ? '시간 미상' : input.birthTime || '미입력'],
    ['달력 기준', getCalendarLabel(input)],
    ['성별', getGenderLabel(input)]
  ];

  return (
    <>
      <section className="gs-cover" aria-labelledby="gs-cover-title">
        <div className="gs-cover-layout">
          <div className="gs-cover-copy">
            <p className="gs-eyebrow">PREMIUM MYEONGRI REPORT</p>
            <h1 id="gs-cover-title">
              <span>{report.customerName}님의</span>
              종합 사주 분석서
            </h1>
            <p className="gs-cover-subtitle">
              사람의 흐름과 선택의 패턴을 읽어,<br />앞으로의 방향을 정리한 개인 명리 리포트입니다.
            </p>

            <dl className="gs-cover-facts" aria-label="분석에 사용한 출생정보">
              {coverFacts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>

            <blockquote>“{report.heroNote}”</blockquote>

            <div className="gs-current-flow">
              <span>현재 10년의 흐름</span>
              <strong>{report.currentDayun.name} 대운</strong>
              <p>{report.currentDayun.range}</p>
            </div>
          </div>

          <figure className="gs-cover-visual">
            <picture>
              <source media="(min-width: 700px)" srcSet="/home-general-saju-premium-cover-941.jpg" />
              <img
                src="/home-general-saju-premium-cover-600.jpg"
                alt="운월당 종합사주 분석서 표지"
                width="600"
                height="1067"
                loading="eager"
                fetchPriority="high"
              />
            </picture>
            <figcaption>
              <span>PRIVATE MYEONGRI REPORT</span>
              <strong>{currentYear?.year || 'CURRENT'} EDITION</strong>
            </figcaption>
          </figure>
        </div>

        <div className="gs-cover-signature" aria-label="사주 원국 서명">
          <span>四柱原局</span>
          <strong>{pillarSignature}</strong>
          <em>{report.pillars.day} 일주 · {report.dayMaster} 일간</em>
        </div>

        <p className="gs-input-summary">{report.birthLabel}</p>

        <div className="gs-precision-note" role="note">
          {precision === 'unknown' ? (
            <p><strong>출생시간 미상 기준</strong> — 년주·월주·일주와 시주 비의존 분석은 정상 계산했으며, 시주에만 의존하는 판단은 유보했습니다.</p>
          ) : precision === 'range' ? (
            <p><strong>출생시간 범위 기준</strong> — 안정적인 년주·월주·일주는 확정했고, 선택 범위에 따라 시주가 달라질 수 있는 부분만 조건부로 설명합니다.</p>
          ) : (
            <p><strong>{input.birthTime} 분 단위 입력 기준</strong> — 입력한 시간과 설정한 날짜 경계 정책을 계산에 반영했습니다.</p>
          )}
        </div>
      </section>

      <div className="gs-reading-nav-shell">
        <nav className="gs-reading-nav" aria-label="리포트 주요 장 이동">
          <a href="#briefing"><span>01</span><strong>핵심 요약</strong></a>
          <a href="#glance"><span>02</span><strong>사주 원국</strong></a>
          <a href="#fortune"><span>03</span><strong>대운·세운</strong></a>
          <a href="#summary"><span>04</span><strong>핵심 주제</strong></a>
          {report.questionAnswers.length > 0 ? <a href="#qa"><span>05</span><strong>질문 답변</strong></a> : null}
          <a href="#plan"><span>06</span><strong>실행 전략</strong></a>
        </nav>
      </div>

      <section className="gs-briefing" id="briefing" aria-labelledby="gs-briefing-title">
        <div className="gs-section-heading">
          <span>01 · ESSENTIAL SUMMARY</span>
          <h2 id="gs-briefing-title">한눈에 보는 핵심 요약</h2>
          <p>원국·월령·십성·대운에서 지금 가장 먼저 읽어야 할 결론만 모았습니다.</p>
        </div>
        <div className="gs-briefing-grid">
          {briefing.map((item) => (
            <a key={item.label} href={`#${item.anchor}`} className="gs-briefing-item">
              <strong>{item.label}</strong>
              <span>{item.body}</span>
            </a>
          ))}
        </div>

        <div className="gs-important" aria-labelledby="gs-important-title">
          <h3 id="gs-important-title">이번 분석서에서 가장 중요한 세 가지</h3>
          <ol>
            {important.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="gs-timeline" aria-labelledby="gs-timeline-title">
        <div className="gs-section-heading">
          <span>FLOW PREVIEW · 10-YEAR &amp; YEARLY LUCK</span>
          <h2 id="gs-timeline-title">대운·세운 미리보기</h2>
          <p>지금의 대운에서 다음 흐름까지, 먼저 방향을 잡고 뒤에서 세부 시기를 확인하세요.</p>
        </div>
        <ol>
          <li>
            <span>현재 대운</span>
            <strong>{report.currentDayun.name} 대운</strong>
            <p>{report.currentDayun.focus}</p>
          </li>
          {currentYear ? (
            <li>
              <span>{currentYear.year} 세운</span>
              <strong>{currentYear.ganzhi}년</strong>
              <p>{currentYear.focus}</p>
            </li>
          ) : null}
          {nextYear ? (
            <li>
              <span>{nextYear.year} 세운</span>
              <strong>{nextYear.ganzhi}년</strong>
              <p>{nextYear.focus}</p>
            </li>
          ) : null}
          <li>
            <span>다음 대운</span>
            <strong>{report.nextDayun.name} 대운</strong>
            <p>{report.nextDayun.focus}</p>
          </li>
        </ol>
        <a className="gs-inline-link" href="#fortune">대운·세운·월운 자세히 보기</a>
      </section>
    </>
  );
}
