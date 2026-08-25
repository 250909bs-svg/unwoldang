import type { IntakeFormData } from '../../api/mockData';
import type { ReportSection, SajuReportData } from '../../lib/saju/report';
import './generalSignatureReport.css';

const STEM_HANJA: Record<string, string> = {
  갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸',
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
  return compactInsight(section?.callout?.body || section?.cards?.[0]?.body || section?.paragraphs?.[0] || section?.bullets?.[0] || fallback);
}

function getTimePrecision(input: Partial<IntakeFormData>, report: SajuReportData) {
  if (input.isUnknownTime || report.engineMeta?.calculationPrecision === 'unknown') return 'unknown';
  if (input.birthTimePrecision === 'branch-range' || report.engineMeta?.calculationPrecision === 'legacy-range') return 'range';
  return 'exact';
}

function buildBriefing(report: SajuReportData): BriefingItem[] {
  const hasConfirmedYongsin = report.engineMeta?.yongsinConsensusStatus === 'confirmed';
  const personality = findSection(report, ['personality', '성향', '작동']);
  const career = findSection(report, ['career', '직업', '사업', '일']);
  const wealth = findSection(report, ['wealth', '재물', '돈']);
  const relationship = findSection(report, ['love', 'marriage', 'relationship', '연애', '결혼', '관계']);
  const strongest = [...report.fiveElements].sort((left, right) => right.value - left.value)[0]?.label;

  return [
    {
      label: '타고난 중심',
      body: compactInsight(`${report.pillars.day} 일주와 ${report.pillars.month} 월령을 중심으로 읽습니다. ${report.heroNote}`),
      anchor: 'glance'
    },
    {
      label: '가장 강한 장점',
      body: report.keyTakeaways[0]?.body || `${strongest || report.dayMasterElement} 기운을 현실의 강점으로 쓰는 힘이 있습니다.`,
      anchor: personality?.id || 'summary'
    },
    {
      label: '반복되는 약점',
      body: `${report.cautiousElements.join('·')} 흐름이 과해지는 순간에는 판단을 서두르거나 혼자 책임을 떠안을 수 있습니다. 결정 전에 범위와 역할을 확인해야 합니다.`,
      anchor: personality?.id || 'summary'
    },
    {
      label: '돈의 핵심',
      body: firstSectionInsight(wealth, hasConfirmedYongsin
        ? `${report.helpfulElements.join('·')} 기운을 활용하되 계약 범위와 정산 기준을 먼저 세울 때 돈을 남기기 쉽습니다.`
        : '월령·강약·현재 대운을 함께 보면, 수입의 크기보다 계약 범위와 정산 기준을 먼저 세우는 일이 중요합니다.'),
      anchor: wealth?.id || 'summary'
    },
    {
      label: '일의 핵심',
      body: firstSectionInsight(career, `${report.tenGods.slice(0, 2).map((item) => item.label).join('·')}의 장점을 역할과 업무 방식에 연결하는 것이 핵심입니다.`),
      anchor: career?.id || 'summary'
    },
    {
      label: '관계의 핵심',
      body: firstSectionInsight(relationship, '감정의 크기보다 오래 유지할 수 있는 생활 리듬과 대화 방식을 먼저 확인하세요.'),
      anchor: relationship?.id || 'summary'
    },
    {
      label: '현재 운의 핵심',
      body: `${report.currentDayun.name} 대운: ${report.currentDayun.summary}`,
      anchor: 'fortune'
    },
    {
      label: '지금 가장 먼저 할 일',
      body: report.actionPlan.priorities[0] || report.actionPlan.dos[0] || '오늘 실행할 수 있는 가장 작은 한 가지를 정하고 기록하세요.',
      anchor: 'plan'
    }
  ];
}

export default function GeneralSignatureReportIntro({
  report,
  input
}: {
  report: SajuReportData;
  input: Partial<IntakeFormData>;
}) {
  const dayPillarHanja = toHanja(report.pillars.day);
  const precision = getTimePrecision(input, report);
  const hasConfirmedYongsin = report.engineMeta?.yongsinConsensusStatus === 'confirmed';
  const keywords = [
    `${report.dayMasterElement} 일간`,
    report.tenGods[0]?.label,
    hasConfirmedYongsin && report.helpfulElements[0]
      ? `${report.helpfulElements[0]} 기운 활용`
      : '월령·강약 종합'
  ].filter((keyword): keyword is string => Boolean(keyword));
  const briefing = buildBriefing(report);
  const currentYear = report.yearLuck[0];
  const nextYear = report.yearLuck[1];
  const important = report.keyTakeaways.slice(0, 3);

  return (
    <>
      <section className="gs-cover" aria-labelledby="gs-cover-title">
        <p className="gs-eyebrow">운월당 정통 종합사주 · 개인 인생 설계서</p>
        <h1 id="gs-cover-title">{report.customerName}님의 운월당 인생 설계서</h1>
        <div className="gs-pillar-mark" aria-label={`${report.pillars.day} 일주`}>
          <span aria-hidden="true">{dayPillarHanja}</span>
          <strong>{report.pillars.day} 일주</strong>
        </div>
        <blockquote>{report.heroNote}</blockquote>

        <ul className="gs-keywords" aria-label="핵심 키워드">
          {keywords.map((keyword) => <li key={keyword}>{keyword}</li>)}
        </ul>

        <div className="gs-current-flow">
          <span>현재 10년의 흐름</span>
          <strong>{report.currentDayun.name} 대운</strong>
          <p>{report.currentDayun.range}</p>
        </div>

        <div className="gs-precision-note" role="note">
          {precision === 'unknown' ? (
            <p><strong>출생시간 미상 기준</strong> — 년주·월주·일주와 시주 비의존 분석은 정상 계산했으며, 시주에만 의존하는 판단은 유보했습니다.</p>
          ) : precision === 'range' ? (
            <p><strong>출생시간 범위 기준</strong> — 안정적인 년주·월주·일주는 확정했고, 선택 범위에 따라 시주가 달라질 수 있는 부분만 조건부로 설명합니다.</p>
          ) : (
            <p><strong>{input.birthTime} 분 단위 입력 기준</strong> — 입력한 시간과 설정한 날짜 경계 정책을 계산에 반영했습니다.</p>
          )}
        </div>

        <div className="gs-important" aria-labelledby="gs-important-title">
          <h2 id="gs-important-title">이번 인생 설계서에서 가장 중요한 3가지</h2>
          <ol>
            {important.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.body}</span>
              </li>
            ))}
          </ol>
        </div>

        <nav className="gs-cover-actions" aria-label="인생 설계서 바로가기">
          <a href="#briefing">30초 핵심 브리핑</a>
          <a href="#toc">전체 목차</a>
          {report.questionAnswers.length > 0 ? <a href="#qa">내 질문 답변</a> : null}
        </nav>
      </section>

      <section className="gs-briefing" id="briefing" aria-labelledby="gs-briefing-title">
        <div className="gs-section-heading">
          <span>핵심 요약</span>
          <h2 id="gs-briefing-title">30초 핵심 브리핑</h2>
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
      </section>

      <section className="gs-timeline" aria-labelledby="gs-timeline-title">
        <div className="gs-section-heading">
          <span>시간 흐름</span>
          <h2 id="gs-timeline-title">시간의 설계</h2>
          <p>지금에서 다음 대운까지, 먼저 방향을 잡고 뒤에서 상세 흐름을 확인하세요.</p>
        </div>
        <ol>
          <li>
            <span>지금</span>
            <strong>{report.currentDayun.name} 대운</strong>
            <p>{report.currentDayun.focus}</p>
          </li>
          {currentYear ? (
            <li>
              <span>올해 · {currentYear.year}</span>
              <strong>{currentYear.ganzhi}년</strong>
              <p>{currentYear.focus}</p>
            </li>
          ) : null}
          {nextYear ? (
            <li>
              <span>내년 · {nextYear.year}</span>
              <strong>{nextYear.ganzhi}년</strong>
              <p>{nextYear.focus}</p>
            </li>
          ) : null}
          <li>
            <span>다음 10년</span>
            <strong>{report.nextDayun.name} 대운</strong>
            <p>{report.nextDayun.focus}</p>
          </li>
        </ol>
        <a className="gs-inline-link" href="#fortune">대운·세운·월운 자세히 보기</a>
      </section>
    </>
  );
}
