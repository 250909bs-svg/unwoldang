import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { User } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { findServiceById, type IntakeFormData } from '../api/mockData';
import { clearPendingPayment } from '../lib/auth';
import { saveReportArchiveEntry } from '../lib/reportArchive';
import { buildSajuReport } from '../lib/saju/reportBuilder';
import type { ReportSection, SajuReportData } from '../lib/saju/report';

type ReportLocationState = {
  formData?: Partial<IntakeFormData>;
  paymentMethod?: string;
  orderId?: string;
  reportData?: SajuReportData;
};

const PREVIEW_FORM_DATA: Partial<IntakeFormData> = {
  name: '운월당',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'single',
  relationshipDuration: 'under3',
  q1: '지금 가장 조심해야 할 선택은 무엇인가요?',
  q2: '올해 흐름에서 가장 강하게 잡아야 할 기회는 무엇인가요?'
};

const PILLAR_LABELS = [
  { key: 'year', label: '연주', hanja: '年', note: '배경과 성장 환경' },
  { key: 'month', label: '월주', hanja: '月', note: '월령과 사회적 흐름' },
  { key: 'day', label: '일주', hanja: '日', note: '나의 중심축' },
  { key: 'hour', label: '시주', hanja: '時', note: '생활 리듬과 습관' }
] as const;

const STEM_HANJA: Record<string, string> = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸'
};

const BRANCH_HANJA: Record<string, string> = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥'
};

const STEM_ELEMENT: Record<string, string> = {
  갑: '목',
  을: '목',
  병: '화',
  정: '화',
  무: '토',
  기: '토',
  경: '금',
  신: '금',
  임: '수',
  계: '수'
};

const BRANCH_ELEMENT: Record<string, string> = {
  인: '목',
  묘: '목',
  사: '화',
  오: '화',
  진: '토',
  술: '토',
  축: '토',
  미: '토',
  신: '금',
  유: '금',
  자: '수',
  해: '수'
};

function parsePillar(pillar: string | null) {
  if (!pillar || pillar === '미상') {
    return null;
  }

  const [stem, branch] = [...pillar];

  return {
    stem,
    branch,
    stemHanja: STEM_HANJA[stem] || stem,
    branchHanja: BRANCH_HANJA[branch] || branch,
    stemElement: STEM_ELEMENT[stem] || '',
    branchElement: BRANCH_ELEMENT[branch] || ''
  };
}

function SajuWonGukBoard({ report }: { report: SajuReportData }) {
  return (
    <article className="premium-wonguk-board">
      <div className="premium-wonguk-frame">
        <div className="premium-wonguk-columns">
          {PILLAR_LABELS.map((pillar) => {
            const value = report.pillars[pillar.key];
            const parsed = parsePillar(value);
            const isMissingHour = pillar.key === 'hour' && !value;

            return (
              <section key={pillar.key} className="premium-wonguk-column">
                <div className="premium-wonguk-head">
                  <strong>{pillar.hanja}</strong>
                  <span>{pillar.label}</span>
                </div>

                {parsed ? (
                  <>
                    <div className="premium-wonguk-chip" data-element={parsed.stemElement}>
                      <span>천간</span>
                      <strong>{parsed.stemHanja}</strong>
                      <em>
                        {parsed.stem} · {parsed.stemElement}
                      </em>
                    </div>
                    <div className="premium-wonguk-chip" data-element={parsed.branchElement}>
                      <span>지지</span>
                      <strong>{parsed.branchHanja}</strong>
                      <em>
                        {parsed.branch} · {parsed.branchElement}
                      </em>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="premium-wonguk-chip empty">
                      <span>천간</span>
                      <strong>?</strong>
                      <em>미상</em>
                    </div>
                    <div className="premium-wonguk-chip empty">
                      <span>지지</span>
                      <strong>?</strong>
                      <em>미상</em>
                    </div>
                  </>
                )}

                <p>{isMissingHour ? '시간 미상 기준' : pillar.note}</p>
              </section>
            );
          })}
        </div>
      </div>

    </article>
  );
}

function ElementDistributionBoard({ report }: { report: SajuReportData }) {
  const maxValue = Math.max(...report.fiveElements.map((item) => item.value), 1);

  return (
    <article className="premium-distribution-card">
      <div className="premium-distribution-head">
        <span>五行</span>
        <h3>오행 분포</h3>
      </div>
      <div className="premium-element-medallions">
        {report.fiveElements.map((item) => (
          <div
            key={item.label}
            className={item.value === 0 ? 'premium-element-medallion empty' : 'premium-element-medallion'}
            style={{ '--element-color': item.color, '--element-level': `${Math.max(14, (item.value / maxValue) * 100)}%` } as React.CSSProperties}
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em />
          </div>
        ))}
      </div>
    </article>
  );
}

function TenGodDistributionBoard({ report }: { report: SajuReportData }) {
  const tenGods = report.tenGods.slice(0, 6);
  const maxValue = Math.max(...tenGods.map((item) => item.value), 1);

  return (
    <article className="premium-distribution-card ten">
      <div className="premium-distribution-head">
        <span>十星</span>
        <h3>십성 분포</h3>
      </div>
      <div className="premium-tengod-seals">
        {tenGods.map((item, index) => (
          <div
            key={item.label}
            className="premium-tengod-seal"
            style={{ '--seal-level': `${Math.max(16, (item.value / maxValue) * 100)}%` } as React.CSSProperties}
          >
            <small>{String(index + 1).padStart(2, '0')}</small>
            <strong>{item.label}</strong>
            <span>{item.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function DayunCards({ report }: { report: SajuReportData }) {
  return (
    <div className="premium-dayun-grid">
      <article className="premium-dayun-card current">
        <span>현재 대운</span>
        <strong>
          {report.currentDayun.name} · {report.currentDayun.range}
        </strong>
        <p>{report.currentDayun.summary}</p>
      </article>
      <article className="premium-dayun-card">
        <span>다음 대운</span>
        <strong>
          {report.nextDayun.name} · {report.nextDayun.range}
        </strong>
        <p>{report.nextDayun.summary}</p>
      </article>
    </div>
  );
}

function FortuneTimeline({ report }: { report: SajuReportData }) {
  return (
    <div className="premium-fortune-timeline">
      {report.yearLuck.slice(0, 5).map((item, index) => (
        <article key={item.year} className={index === 0 ? 'active' : ''}>
          <span>{item.year}</span>
          <strong>
            {item.ganzhi} · {item.score}점
          </strong>
          <p>{item.headline}</p>
        </article>
      ))}
    </div>
  );
}

function MonthRibbon({ report }: { report: SajuReportData }) {
  return (
    <div className="premium-month-ribbon">
      {report.monthLuck.slice(0, 6).map((item) => (
        <article key={`${item.year}-${item.month}`}>
          <span>
            {item.year}.{String(item.month).padStart(2, '0')}
          </span>
          <div className="premium-month-meter">
            <em style={{ width: `${item.score}%` }} />
          </div>
          <strong>{item.score}</strong>
        </article>
      ))}
    </div>
  );
}

function SectionBlock({
  section,
  number,
  report
}: {
  section: ReportSection;
  number: string;
  report: SajuReportData;
}) {
  const visibleDetails =
    section.id === 'element'
      ? section.details?.filter((detail) => detail.summary !== '오행 강약 보기')
      : section.details;
  const visibleTable = section.id === 'saju' ? null : section.table;
  const sectionClassName =
    section.id === 'love' ? 'premium-report-section premium-love-section' : 'premium-report-section';
  const cardGridClassName =
    section.id === 'love'
      ? 'premium-love-card-grid'
      : section.cards?.length && section.cards.length >= 3
        ? 'premium-grid3'
        : 'premium-grid2';

  return (
    <section className={sectionClassName} id={section.id}>
      <div className="premium-section-heading">
        <div className="premium-section-title-wrap">
          <span className="premium-section-index">{number}</span>
          <div>
            <h2>{section.title}</h2>
            {section.subtitle ? <p className="premium-muted">{section.subtitle}</p> : null}
          </div>
        </div>
      </div>

      {section.id === 'fortune' ? <DayunCards report={report} /> : null}
      {section.id === 'year' ? <FortuneTimeline report={report} /> : null}
      {section.id === 'month' ? <MonthRibbon report={report} /> : null}

      {section.callout ? (
        <div className="premium-callout">
          {section.callout.title ? <h3>{section.callout.title}</h3> : null}
          <p>{section.callout.body}</p>
        </div>
      ) : null}

      {section.paragraphs?.length ? (
        <div className="premium-prose">
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : null}

      {section.bullets?.length ? (
        <ul className="premium-list">
          {section.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      ) : null}

      {visibleTable ? (
        <div className="premium-table-wrap">
          <table className="premium-table">
            <thead>
              <tr>
                {visibleTable.headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleTable.rows.map((row, rowIndex) => (
                <tr key={`${section.id}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${section.id}-cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {section.cards?.length ? (
        <div className={cardGridClassName}>
          {section.cards.map((card, cardIndex) => (
            <article
              key={`${section.id}-${card.title}`}
              className={`premium-card ${section.id === 'love' ? 'premium-love-card' : ''} ${card.tone ? `tone-${card.tone}` : ''}`}
              style={
                section.id === 'love'
                  ? ({ '--love-card-index': cardIndex + 1 } as CSSProperties & Record<'--love-card-index', number>)
                  : undefined
              }
            >
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              {card.badge ? <span className="premium-mini-badge">{card.badge}</span> : null}
            </article>
          ))}
        </div>
      ) : null}

      {visibleDetails?.length ? (
        <div className="premium-accordion-group">
          {visibleDetails.map((detail) => (
            <details key={`${section.id}-${detail.summary}`} className="premium-accordion" open={detail.open}>
              <summary>
                <span>{detail.summary}</span>
                <span className="premium-details-hint">열기/닫기</span>
              </summary>
              <div className="premium-accordion-body">
                {detail.content.split('\n\n').map((paragraph, index) => (
                  <p key={`${section.id}-${detail.summary}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function buildExpandedCoreReport(report: SajuReportData): SajuReportData {
  const strongestElement = [...report.fiveElements].sort((left, right) => right.value - left.value)[0];
  const weakestElement = [...report.fiveElements].sort((left, right) => left.value - right.value)[0];
  const dominantTenGod = report.tenGods[0];
  const firstQuestion = report.questionAnswers[0];
  const secondQuestion = report.questionAnswers[1];
  const currentYear = report.yearLuck[0];
  const bestMonth = [...report.monthLuck].sort((left, right) => right.score - left.score)[0];
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];
  const originalAnalysis = report.summary.analysis.filter(Boolean);

  return {
    ...report,
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 핵심 요약`,
      analysis: [
        `${report.customerName}님의 명식에서 가장 먼저 봐야 할 축은 일간 ${report.dayMaster}와 ${report.strengthLabel}, 그리고 ${report.currentDayun.name} 대운이 만나는 지점입니다. 이 조합은 단순히 성향을 설명하는 것이 아니라 지금 어떤 방식으로 일, 돈, 관계를 정리해야 결과가 남는지를 보여줍니다.`,
        `오행에서는 ${strongestElement?.label || report.helpfulElements[0]} 기운이 가장 크게 드러나고, ${weakestElement?.label || report.cautiousElements[0]} 기운은 보완 포인트로 읽힙니다. 강한 기운은 장점이지만 과하면 고집, 속도 조절 실패, 피로 누적으로 바뀔 수 있습니다. 약한 기운은 부족함이라기보다 의식적으로 루틴과 환경을 만들어야 하는 영역입니다.`,
        `십성 흐름에서는 ${dominantTenGod?.label || '주요 십성'} 기운이 앞에 서기 때문에, 올해의 핵심은 감으로 밀어붙이는 선택보다 역할, 책임, 계약, 수익 구조를 분명히 하는 데 있습니다. 특히 말로만 정한 약속보다 문서, 가격표, 일정표처럼 확인 가능한 기준을 세울수록 운이 안정됩니다.`,
        `현재 대운인 ${report.currentDayun.name}은 "${report.currentDayun.focus}" 쪽으로 흐름을 모으라고 말합니다. 반대로 주의할 점은 ${report.currentDayun.caution}입니다. 즉 기회가 없는 사주가 아니라, 기회를 어떤 순서로 현실화할지 정하지 않으면 좋은 흐름도 흩어질 수 있는 사주입니다.`,
        currentYear
          ? `${currentYear.year}년의 포인트는 "${currentYear.headline}"입니다. 집중해야 할 것은 ${currentYear.focus}이고, 조심해야 할 것은 ${currentYear.warning}입니다. 올해는 큰 결정을 빨리 내리는 것보다, 선택 이후 감당해야 할 돈, 시간, 책임을 먼저 계산하는 쪽이 더 맞습니다.`
          : originalAnalysis[0] || report.heroNote,
        bestMonth && watchMonth
          ? `가까운 월운에서는 ${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 흐름이 비교적 강하고, ${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} 구간은 무리한 확장보다 정비가 필요합니다. 좋은 달에는 제안과 실행을, 약한 달에는 정산과 수정, 관계 정리를 우선하는 식으로 리듬을 나누는 것이 좋습니다.`
          : originalAnalysis[1] || report.heroNote,
        firstQuestion
          ? `첫 번째 질문에 대해서는 "${firstQuestion.title}"이 핵심 답입니다. ${firstQuestion.analysis}`
          : '첫 번째 질문은 아직 구체화되지 않았지만, 현재 명식에서는 일과 돈의 기준을 먼저 세우는 것이 전체 운의 중심입니다.',
        secondQuestion
          ? `두 번째 질문에 대해서는 "${secondQuestion.title}"이 핵심 답입니다. ${secondQuestion.analysis}`
          : '두 번째 질문이 비어 있다면, 올해는 관계보다 일의 구조와 체력 리듬을 먼저 안정시키는 쪽이 우선입니다.'
      ],
      advice: [
        `${report.helpfulElements.join(', ')} 기운을 살리는 루틴을 하나 정하고 매일 반복하세요. 이 사주는 즉흥적인 결심보다 반복 가능한 구조에서 운이 살아납니다.`,
        `돈과 일은 따로 보지 말고, 가격표, 제공 범위, 마감일, 책임 범위를 한 장으로 정리하세요. 이 문서화가 올해 가장 중요한 개운 포인트입니다.`,
        `좋은 제안이 들어와도 바로 넓히지 말고, 지금 대운의 주제인 "${report.currentDayun.focus}"와 맞는지 먼저 확인하세요.`,
        bestMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')}처럼 점수가 높은 구간에는 실행과 제안을, 점수가 낮은 구간에는 정산과 수정에 힘을 쓰세요.`
          : '운이 강한 구간에는 실행을, 약한 구간에는 정비를 우선하세요.',
        `관계는 감정만 보지 말고 상대의 시간 약속, 돈 쓰는 방식, 책임감, 갈등 후 회복 방식을 함께 보세요.`
      ]
    },
    keyTakeaways: [
      {
        title: '핵심',
        body: `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운이 만나는 지금은 감보다 기준, 확장보다 구조가 먼저입니다.`,
        tone: 'good'
      },
      {
        title: '일',
        body: `직업운은 역할과 결과물이 명확할수록 살아납니다. 제안, 계약, 서비스 범위를 말이 아니라 문서로 정리해야 합니다.`
      },
      {
        title: '돈',
        body: `재물운은 한 번 크게 버는 흐름보다 반복 매출, 가격표, 정산 기준에서 안정됩니다. 새 수익보다 남는 구조가 중요합니다.`,
        tone: 'good'
      },
      {
        title: '관계',
        body: `관계운은 설렘보다 안정감, 책임감, 생활 리듬이 관건입니다. 오래 갈 사람은 말보다 행동의 반복에서 드러납니다.`
      },
      {
        title: '주의',
        body: `${report.cautiousElements.join(', ')} 기운이 과해질 때 판단이 급해지거나 체력이 무너질 수 있습니다. 큰 결정 전에는 하루를 두고 다시 확인하세요.`,
        tone: 'warn'
      },
      {
        title: '시기',
        body: bestMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 전후는 실행에 좋고, 점수가 낮은 달은 정비와 조율에 쓰는 편이 좋습니다.`
          : `올해는 흐름을 월별로 나누어 실행 구간과 정비 구간을 분리하는 것이 좋습니다.`
      }
    ]
  };
}

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { formData, paymentMethod, orderId, reportData } = (location.state as ReportLocationState) || {};
  const service = findServiceById(id);
  const hasReportSource = Boolean(reportData || formData?.birthDate);
  const isLiveHost = typeof window !== 'undefined' && /(^|\.)unwoldang\.com$/i.test(window.location.hostname);
  const shouldBlockPreview = isLiveHost && !hasReportSource;
  const reportInput = formData?.birthDate ? formData : PREVIEW_FORM_DATA;
  const reportCharacterVideo = reportInput.gender === 'female' ? '/report-character-female.mp4' : '/report-character-male.mp4';
  const baseReport = useMemo(() => reportData || buildSajuReport(service.id, reportInput), [reportInput, reportData, service.id]);
  const report = useMemo(() => buildExpandedCoreReport(baseReport), [baseReport]);
  const isYearlyShowcase = report.serviceId === 'life-flow';
  const yearlyLead = report.yearLuck[0];
  const yearlyMomentum = report.yearLuck.slice(0, 3);
  const monthlyHotMonths = [...report.monthLuck].sort((left, right) => right.score - left.score).slice(0, 3);
  const [isTocOpen, setIsTocOpen] = useState(false);

  useEffect(() => {
    if (shouldBlockPreview) {
      navigate(`/form/${service.id}`, { replace: true });
    }
  }, [navigate, service.id, shouldBlockPreview]);

  useEffect(() => {
    if (shouldBlockPreview) {
      return;
    }

    saveReportArchiveEntry({
      id: `${report.serviceId}:${orderId || report.serialNumber}`,
      orderId: orderId || report.serialNumber,
      productId: report.serviceId,
      customerName: report.customerName,
      title: report.title,
      subtitle: report.subtitle,
      createdAt: report.createdAt,
      paymentMethod,
      formData,
      reportData: report
    });
    clearPendingPayment();
  }, [formData, orderId, paymentMethod, report, shouldBlockPreview]);

  if (shouldBlockPreview) {
    return (
      <main className="mobile-page-shell">
        <div className="mobile-page-card">
          <section className="mobile-page-content centered">
            <div className="mobile-loading-card">
              <span className="mobile-chip">REPORT LOCKED</span>
              <h1>입력과 결제 정보를 확인한 뒤 리포트를 열어드릴게요.</h1>
              <p>실서비스에서는 미리보기 리포트를 직접 열 수 없도록 보호하고 있습니다.</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const tocItems = [
    { id: 'summary', label: '1페이지 핵심 결론', number: '01' },
    { id: 'qa', label: '질문 맞춤 답변', number: 'Q' },
    { id: 'glance', label: '핵심 지표 요약', number: '02' },
    ...report.sections.map((section, index) => ({
      id: section.id,
      label: section.title,
      number: String(index + 3).padStart(2, '0')
    })),
    { id: 'plan', label: '실행 전략', number: String(report.sections.length + 3).padStart(2, '0') },
    { id: 'legal', label: '안전 안내', number: String(report.sections.length + 4).padStart(2, '0') }
  ];

  const scrollToSection = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className={isYearlyShowcase ? 'premium-report-page yearly-premium-page' : 'premium-report-page'}>
      <header className="premium-report-topbar">
        <div className="premium-report-topbar-inner">
          <Link to="/" className="premium-report-brand" aria-label="운월당 홈">
            운월당
          </Link>

          <div className="premium-report-top-actions">
            <Link to="/my" className="app-profile-button" aria-label="마이페이지">
              <User size={17} strokeWidth={2.2} />
            </Link>
          </div>
        </div>
      </header>

      <div className={isYearlyShowcase ? 'premium-report-shell yearly-report-shell' : 'premium-report-shell'}>
        <article className={isYearlyShowcase ? 'premium-report-paper yearly-report-paper' : 'premium-report-paper'}>
          <section className={isYearlyShowcase ? 'premium-report-cover yearly-report-cover' : 'premium-report-cover'}>
            <h1>
              {report.customerName} {report.title.replace('프리미엄 ', '')}
            </h1>
            <p className="premium-report-subtitle">입력한 사주 정보와 질문을 기준으로 정리한 운월당 개인 감정서입니다.</p>

            {isYearlyShowcase && yearlyLead ? (
              <div className="yearly-report-orbit">
                <article className="yearly-report-orbit-lead">
                  <span className="yearly-report-kicker">2026 YEAR COMPASS</span>
                  <strong>{yearlyLead.headline}</strong>
                  <p>{yearlyLead.summary}</p>
                </article>

                <div className="yearly-report-orbit-grid">
                  {yearlyMomentum.map((item) => (
                    <article key={item.year} className="yearly-report-orbit-card">
                      <span>{item.year}</span>
                      <strong>{item.headline}</strong>
                      <p>{item.focus}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

          </section>

          <div className="premium-divider" />

          {isYearlyShowcase ? (
            <>
              <section className="premium-report-section yearly-focus-section" id="yearly-focus">
                <div className="premium-section-heading">
                  <div>
                    <h2>2026 흐름 보드</h2>
                    <p className="premium-muted">현재 대운, 세운, 월운 하이라이트를 한 번에 읽어보는 프리뷰 보드입니다.</p>
                  </div>
                </div>

                <div className="yearly-focus-grid">
                  <article className="premium-card yearly-focus-card emphasis">
                    <span className="yearly-focus-label">CURRENT FLOW</span>
                    <strong>
                      {report.currentDayun.name} 대운 · {report.currentDayun.range}
                    </strong>
                    <p>{report.currentDayun.summary}</p>
                  </article>

                  <article className="premium-card yearly-focus-card">
                    <span className="yearly-focus-label">BEST MONTHS</span>
                    <div className="yearly-focus-list">
                      {monthlyHotMonths.map((item) => (
                        <div key={`${item.year}-${item.month}-best`} className="yearly-focus-list-item">
                          <strong>
                            {item.year}.{String(item.month).padStart(2, '0')}
                          </strong>
                          <span>{item.score}점</span>
                        </div>
                      ))}
                    </div>
                    <p>
                      {monthlyHotMonths[0]
                        ? `${monthlyHotMonths[0].year}.${String(monthlyHotMonths[0].month).padStart(2, '0')} 흐름이 가장 강하게 붙는 구간으로 보입니다.`
                        : '월운 하이라이트를 구성 중입니다.'}
                    </p>
                  </article>

                  <article className="premium-card yearly-focus-card">
                    <span className="yearly-focus-label">THIS YEAR</span>
                    <strong>{yearlyLead?.headline}</strong>
                    <p>{yearlyLead?.focus}</p>
                  </article>
                </div>

                <MonthRibbon report={report} />
              </section>

              <div className="premium-divider" />
            </>
          ) : null}

          {report.serviceId === 'general-signature' ? (
            <section className="premium-report-character" aria-label="운월당 종합사주 캐릭터">
              <video className="premium-report-character-video" src={reportCharacterVideo} autoPlay muted loop playsInline preload="metadata" />
              <div className="premium-report-character-glow" aria-hidden="true" />
            </section>
          ) : null}

          <section className="premium-report-section" id="toc">
            <button
              type="button"
              className={isTocOpen ? 'premium-toc-header open' : 'premium-toc-header'}
              aria-expanded={isTocOpen}
              onClick={() => setIsTocOpen((value) => !value)}
            >
              <div>
                <span>목차</span>
                <strong>리포트 전체 흐름 보기</strong>
                <em>필요한 부분만 빠르게 이동할 수 있습니다.</em>
              </div>
              <span className="premium-toc-arrow" aria-hidden="true">
                &gt;
              </span>
            </button>

            {isTocOpen ? (
              <div className="premium-toc">
                {tocItems.map((item) => (
                  <button key={item.id} type="button" className="premium-toc-item" onClick={() => scrollToSection(item.id)}>
                    <span className="premium-toc-label">{item.label}</span>
                    <span className="premium-toc-number">{item.number}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <div className="premium-divider" />

          <section className="premium-report-section" id="summary">
            <div className="premium-section-heading">
              <div>
                <h2>{report.summary.title}</h2>
                <p className="premium-muted">이번 사주의 핵심과 지금 가장 중요한 포인트를 먼저 정리했습니다.</p>
              </div>
            </div>

            <div className="premium-callout">
              {report.summary.analysis.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>

            <div className="premium-grid3">
              {report.keyTakeaways.map((item) => (
                <article key={item.title} className={`premium-card premium-key-card ${item.tone ? `tone-${item.tone}` : ''}`}>
                  <span className="premium-key-label">{item.title}</span>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <details className="premium-accordion" open>
              <summary>
                <span>실천 과제</span>
                <span className="premium-details-hint">열기/닫기</span>
              </summary>
              <div className="premium-accordion-body">
                <ul className="premium-list">
                  {report.summary.advice.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </details>
          </section>

          <div className="premium-divider" />

          <section className="premium-report-section" id="qa">
            <div className="premium-section-heading">
              <div>
                <h2>궁금증에 대한 명확한 해답</h2>
                <p className="premium-muted">고객 질문 맞춤 분석</p>
              </div>
            </div>

            {report.questionAnswers.length ? (
              report.questionAnswers.map((qa, index) => (
                <div key={`${qa.question}-${index}`} className="premium-qa-block">
                  <div className="premium-card premium-question-card">
                    <h3>Q. {qa.question}</h3>
                  </div>
                  <div className="premium-card premium-answer-card">
                    <h3>{qa.title}</h3>
                    <p>{qa.analysis}</p>
                    <ul className="premium-list">
                      {qa.advice.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))
            ) : (
              <div className="premium-card">
                <p>고객 질문이 아직 입력되지 않아 원국 중심 분석으로 먼저 정리했습니다.</p>
              </div>
            )}
          </section>

          <div className="premium-divider" />

          <section className="premium-report-section" id="glance">
            <div className="premium-section-heading">
              <div>
                <h2>핵심 지표 요약</h2>
              </div>
            </div>

            <SajuWonGukBoard report={report} />

            <div className="premium-grid2 premium-glance-chart-grid">
              <ElementDistributionBoard report={report} />
              <TenGodDistributionBoard report={report} />
            </div>
          </section>

          {report.sections.map((section, index) => (
            <div key={section.id}>
              <div className="premium-divider" />
              <SectionBlock section={section} number={String(index + 3).padStart(2, '0')} report={report} />
            </div>
          ))}

          <div className="premium-divider" />

          <section className="premium-report-section" id="plan">
            <div className="premium-section-heading">
              <div>
                <h2>{report.actionPlan.title}</h2>
                <p className="premium-muted">지금 바로 실행할 우선순위를 정리했습니다.</p>
              </div>
            </div>

            <details className="premium-accordion" open>
              <summary>
                <span>우선순위 3가지</span>
                <span className="premium-details-hint">열기/닫기</span>
              </summary>
              <div className="premium-accordion-body">
                <ul className="premium-list">
                  {report.actionPlan.priorities.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </details>

            <div className="premium-grid2">
              <article className="premium-card tone-good">
                <h3>DO</h3>
                <ul className="premium-list">
                  {report.actionPlan.dos.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className="premium-card tone-warn">
                <h3>AVOID</h3>
                <ul className="premium-list">
                  {report.actionPlan.avoids.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </div>

            <div className="premium-grid2 premium-plan-days">
              <article className="premium-card">
                <h3>행운일</h3>
                <ul className="premium-list">
                  {report.actionPlan.luckyDays.map((item) => (
                    <li key={`lucky-${item.day}`}>
                      {item.day}일: {item.reason}
                    </li>
                  ))}
                </ul>
              </article>

              <article className="premium-card">
                <h3>주의일</h3>
                <ul className="premium-list">
                  {report.actionPlan.unluckyDays.map((item) => (
                    <li key={`unlucky-${item.day}`}>
                      {item.day}일: {item.reason}
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <div className="premium-divider" />

          <section className="premium-report-section" id="legal">
            <div className="premium-section-heading">
              <div>
                <h2>안전 안내</h2>
                <p className="premium-muted">리포트 이용 전 함께 확인해야 할 안내입니다.</p>
              </div>
            </div>

            <div className="premium-grid3">
              {report.legalNotice.map((item) => (
                <article key={item} className="premium-card premium-legal-card">
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>

          <footer className="premium-report-footer">
            운월당 리포트는 입력한 생년월일시와 질문을 기준으로 작성된 개인 감정서입니다. 실제 선택은 현재의 상황과 함께
            종합해 판단해 주세요.
          </footer>
        </article>
      </div>
    </main>
  );
}
