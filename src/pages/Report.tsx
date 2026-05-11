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
  const strongest = [...report.fiveElements].sort((left, right) => right.value - left.value)[0];
  const weakest = [...report.fiveElements].sort((left, right) => left.value - right.value)[0];
  const balanceLabel = strongest && weakest ? `${strongest.label} 중심 · ${weakest.label} 보완` : '오행 균형';

  return (
    <article className="premium-distribution-card premium-element-compass">
      <div className="premium-distribution-head">
        <span>五行</span>
        <h3>오행 분포</h3>
      </div>
      <div className="premium-element-compass-core">
        <span>균형 판정</span>
        <strong>{balanceLabel}</strong>
        <em>강한 기운은 살리고 빈 곳은 생활 루틴으로 보완합니다.</em>
      </div>
      <div className="premium-element-medallions">
        {report.fiveElements.map((item, index) => (
          <div
            key={item.label}
            className={item.value === 0 ? 'premium-element-medallion empty' : 'premium-element-medallion'}
            style={
              {
                '--element-color': item.color,
                '--element-level': `${Math.max(14, (item.value / maxValue) * 100)}%`,
                '--element-index': index + 1
              } as React.CSSProperties & Record<'--element-index', number>
            }
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{Math.round((item.value / maxValue) * 100)}%</em>
          </div>
        ))}
      </div>
    </article>
  );
}

function TenGodDistributionBoard({ report }: { report: SajuReportData }) {
  const tenGods = report.tenGods.slice(0, 8);
  const maxValue = Math.max(...tenGods.map((item) => item.value), 1);
  const topThree = tenGods.slice(0, 3).map((item) => item.label).join(' · ');

  return (
    <article className="premium-distribution-card ten premium-tengod-board">
      <div className="premium-distribution-head">
        <span>十星</span>
        <h3>십성 분포</h3>
      </div>
      <div className="premium-tengod-lead">
        <span>상위 흐름</span>
        <strong>{topThree}</strong>
      </div>
      <div className="premium-tengod-seals">
        {tenGods.map((item, index) => (
          <div
            key={item.label}
            className={index < 3 ? 'premium-tengod-seal major' : 'premium-tengod-seal'}
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

function PremiumDayunFlow({ report }: { report: SajuReportData }) {
  const windows = [
    {
      label: '현재 대운',
      window: report.currentDayun,
      className: 'current'
    },
    {
      label: '다음 대운',
      window: report.nextDayun,
      className: 'next'
    }
  ];

  return (
    <div className="premium-dayun-grid premium-dayun-flow">
      {windows.map((item) => (
        <article key={item.label} className={`premium-dayun-card ${item.className}`}>
          <span>{item.label}</span>
          <strong>
            {item.window.name} · {item.window.range}
          </strong>
          <em>{item.window.focus}</em>
          <p>{item.window.summary}</p>
        </article>
      ))}
    </div>
  );
}

function PremiumFortuneTimeline({ report }: { report: SajuReportData }) {
  return (
    <div className="premium-fortune-timeline premium-year-flow">
      {report.yearLuck.slice(0, 5).map((item, index) => (
        <article key={item.year} className={`${index === 0 ? 'active' : ''} ${item.score >= 80 ? 'high' : item.score < 55 ? 'low' : 'mid'}`}>
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

function PremiumMonthCalendar({ report }: { report: SajuReportData }) {
  return (
    <div className="premium-month-ribbon premium-month-calendar">
      {report.monthLuck.slice(0, 6).map((item) => (
        <article key={`${item.year}-${item.month}`} className={item.score >= 80 ? 'high' : item.score < 55 ? 'low' : 'mid'}>
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

void DayunCards;
void FortuneTimeline;
void MonthRibbon;

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

      {section.id === 'fortune' ? <PremiumDayunFlow report={report} /> : null}
      {section.id === 'year' ? <PremiumFortuneTimeline report={report} /> : null}
      {section.id === 'month' ? <PremiumMonthCalendar report={report} /> : null}

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
        `${report.customerName}님의 명식은 일간 ${report.dayMaster}, ${report.strengthLabel}, 그리고 ${report.currentDayun.name} 대운을 함께 봐야 정확합니다. 겉으로는 선택지가 많아 보여도 실제 성패는 “어디까지 맡고, 얼마를 받고, 언제 마무리할지”를 정하는 운영 감각에서 갈립니다.`,
        `오행에서는 ${strongestElement?.label || report.helpfulElements[0]} 쪽 힘이 눈에 띄고, ${weakestElement?.label || report.cautiousElements[0]} 영역은 의식적으로 보완해야 합니다. 강한 기운은 추진력과 판단력으로 쓰이면 좋지만, 피곤할 때는 고집, 과속, 말의 단정으로 튀어나올 수 있습니다. 약한 기운은 결핍이라기보다 생활 리듬과 주변 환경으로 채워야 하는 자리입니다.`,
        `십성 흐름에서는 ${dominantTenGod?.label || '주요 십성'}의 색이 앞에 섭니다. 그래서 올해는 감으로 밀어붙이는 해가 아니라, 역할 분리, 정산 기준, 가격 기준, 일정 통제를 선명하게 잡을수록 결과가 남습니다. 구두 약속보다 계약 습관을 들이고, “좋은 제안”도 내 체력과 책임 범위 안에 들어오는지 먼저 봐야 합니다.`,
        `현재 대운인 ${report.currentDayun.name}은 "${report.currentDayun.focus}" 쪽으로 힘을 모으게 합니다. 다만 ${report.currentDayun.caution}가 같이 따라오기 때문에, 무작정 기회를 늘리는 방식은 오히려 피로와 누수를 만들 수 있습니다. 이 사주는 기회가 부족한 타입이 아니라, 들어온 흐름을 정리해서 내 몫으로 남기는 힘이 관건입니다.`,
        currentYear
          ? `${currentYear.year}년의 포인트는 "${currentYear.headline}"입니다. 집중해야 할 것은 ${currentYear.focus}이고, 조심해야 할 것은 ${currentYear.warning}입니다. 큰 결정을 빨리 내리는 것보다, 선택 이후 생길 지출, 회의, 마감, 사람 관리까지 감당 가능한지 먼저 계산하는 편이 맞습니다.`
          : originalAnalysis[0] || report.heroNote,
        bestMonth && watchMonth
          ? `가까운 월운에서는 ${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 흐름이 비교적 좋고, ${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} 구간은 속도를 줄여야 합니다. 강한 달에는 제안, 공개, 실행을 걸고 약한 달에는 정산, 수정, 관계 정리, 체력 회복에 쓰면 손실이 줄어듭니다.`
          : originalAnalysis[1] || report.heroNote,
        firstQuestion
          ? `첫 번째 질문의 답은 "${firstQuestion.title}" 쪽에 가깝습니다. ${firstQuestion.analysis} 여기서 중요한 장면은 누군가 좋은 말을 해주는 순간이 아니라, 실제로 일정이 잡히고 돈의 흐름이 생기며 책임자가 분명해지는 순간입니다.`
          : '첫 번째 질문은 아직 구체화되지 않았지만, 현재 명식에서는 일과 돈의 기준을 먼저 세우는 것이 전체 운의 중심입니다.',
        secondQuestion
          ? `두 번째 질문의 핵심은 "${secondQuestion.title}"입니다. ${secondQuestion.analysis} 감정적으로는 더 큰 판을 원해도, 현실에서는 에너지 배분과 우선순위를 잘라내는 능력이 만족도를 만듭니다.`
          : '두 번째 질문이 비어 있다면, 올해는 관계보다 일의 운영 체계와 체력 리듬을 먼저 안정시키는 쪽이 우선입니다.'
      ],
      advice: [
        `${report.helpfulElements.join(', ')} 흐름을 살리는 생활 리듬을 하나 정하세요. 수면, 운동, 업무 시작 시간처럼 몸이 따라오는 루틴이어야 합니다.`,
        `일과 돈은 한 장짜리 운영표로 관리하세요. 가격 기준, 제공 범위, 마감일, 수정 횟수, 책임자를 적어두는 것만으로도 운의 누수가 줄어듭니다.`,
        `좋은 제안이 들어와도 바로 받지 말고, 지금 대운의 주제인 "${report.currentDayun.focus}"와 맞는지 확인하세요. 맞지 않는 제안은 기회처럼 보여도 체력을 먼저 씁니다.`,
        bestMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')}처럼 점수가 높은 구간에는 제안과 실행을, 흐름이 약한 달에는 정산과 수정에 힘을 쓰세요.`
          : '운이 강한 구간에는 실행을, 약한 구간에는 정비를 우선하세요.',
        `관계는 설렘보다 장면을 보세요. 약속 시간, 돈 쓰는 태도, 갈등 후 말투, 바쁠 때의 배려가 오래 갈 인연인지 알려줍니다.`
      ]
    },
    keyTakeaways: [
      {
        title: '핵심',
        body: `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운이 만나는 지금은 판을 키우기보다 운영 체계를 손봐야 할 때입니다.`,
        tone: 'good'
      },
      {
        title: '일',
        body: `직업운은 역할 분리와 결과물 정의에서 살아납니다. “어디까지 해주는가”가 선명할수록 신뢰와 단가가 같이 올라갑니다.`
      },
      {
        title: '돈',
        body: `재물운은 큰 한 방보다 반복 매출, 정산 기준, 가격 조정에서 안정됩니다. 벌리는 돈보다 남기는 돈을 먼저 봐야 합니다.`,
        tone: 'good'
      },
      {
        title: '관계',
        body: `관계운은 말보다 생활 장면에서 드러납니다. 시간 약속, 돈 감각, 갈등 후 회복 방식이 맞는 사람이 오래 갑니다.`
      },
      {
        title: '주의',
        body: `${report.cautiousElements.join(', ')} 흐름이 과열되면 판단이 빨라지고 체력 소모가 커질 수 있습니다. 큰 결정은 하루 묵힌 뒤 다시 보세요.`,
        tone: 'warn'
      },
      {
        title: '시기',
        body: bestMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 전후는 실행에 좋고, 약한 달은 조율, 회복, 재정비에 쓰는 편이 좋습니다.`
          : `올해는 실행 구간과 회복 구간을 분리해야 성과가 오래 갑니다.`
      }
    ]
  };
}

function buildExpertSatisfactionReport(report: SajuReportData): SajuReportData {
  const strongestElement = [...report.fiveElements].sort((left, right) => right.value - left.value)[0];
  const weakestElement = [...report.fiveElements].sort((left, right) => left.value - right.value)[0];
  const dominantTenGod = report.tenGods[0];
  const secondTenGod = report.tenGods[1];
  const currentYear = report.yearLuck[0];
  const bestMonth = [...report.monthLuck].sort((left, right) => right.score - left.score)[0];
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];
  const helpfulText = report.helpfulElements.join(', ');
  const cautiousText = report.cautiousElements.join(', ');
  const strongestLabel = strongestElement?.label || report.helpfulElements[0];
  const weakestLabel = weakestElement?.label || report.cautiousElements[0];
  const dominantLabel = dominantTenGod?.label || '주요 십성';
  const secondLabel = secondTenGod?.label || '보조 십성';

  const expertSummary = [
    `${report.customerName}님의 명식은 일간 ${report.dayMaster}, ${report.strengthLabel}, 현재 ${report.currentDayun.name} 대운을 함께 놓고 보아야 결론이 정확해집니다. 겉으로는 여러 선택지가 동시에 열리는 것처럼 보이지만, 실제 승부처는 더 많이 벌리는 것이 아니라 역할, 가격, 마감, 책임 범위를 선명하게 정리하는 데 있습니다.`,
    `오행 분포에서는 ${strongestLabel} 기운이 앞에 서고 ${weakestLabel} 영역은 의식적으로 보완해야 합니다. 강한 기운은 추진력과 판단력으로 쓰이면 장점이 되지만, 피로가 쌓이면 말이 빨라지고 결론을 서두르며 관계나 일에서 여지를 줄이는 방식으로 나타날 수 있습니다.`,
    `십성 흐름에서는 ${dominantLabel}의 색이 두드러지고 ${secondLabel}이 뒤를 받칩니다. 그래서 이 사주는 감으로 밀어붙일 때보다 고객, 상대, 동료가 무엇을 기대하는지 먼저 분리하고, 제공 범위와 정산 기준을 정해둘 때 결과가 안정됩니다.`,
    `${report.currentDayun.name} 대운의 핵심은 "${report.currentDayun.focus}"입니다. 다만 "${report.currentDayun.caution}"도 함께 따라오기 때문에, 지금 들어오는 기회를 전부 잡으려 하면 오히려 체력과 신뢰를 소모할 수 있습니다. 좋은 제안일수록 일정표, 돈의 흐름, 사람의 책임을 먼저 확인해야 합니다.`,
    currentYear
      ? `${currentYear.year}년은 "${currentYear.headline}"의 해로 읽힙니다. 집중 포인트는 ${currentYear.focus}이고, 주의할 점은 ${currentYear.warning}입니다. 올해의 좋은 운은 한 번에 크게 터지는 방식보다 준비한 것을 보여주고, 반응을 확인하고, 다시 다듬는 반복 속에서 강해집니다.`
      : `${report.customerName}님에게 올해 필요한 태도는 빠른 확정보다 검증입니다. 감정적으로 끌리는 선택이라도 일정, 비용, 사람의 태도, 내 체력까지 확인한 뒤 움직일 때 손실이 줄어듭니다.`,
    bestMonth && watchMonth
      ? `가까운 월운에서는 ${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 흐름이 가장 강하게 열리고, ${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')}에는 속도를 줄이는 편이 좋습니다. 강한 달에는 공개, 제안, 실행을 두고, 약한 달에는 정산, 수정, 관계 정리, 컨디션 회복을 두면 운의 낭비가 줄어듭니다.`
      : `월운은 강하게 움직일 달과 숨을 고를 달을 분리해서 써야 합니다. 좋은 시기에는 새 일을 열고, 약한 시기에는 기존 일을 정리하는 식으로 리듬을 나누면 결과가 오래 갑니다.`,
    `종합하면 이 사주의 핵심은 “운이 있느냐 없느냐”가 아니라 운을 담을 그릇이 준비되어 있느냐입니다. ${helpfulText} 기운은 살리고 ${cautiousText} 기운은 과열되지 않게 조절할 때, 일과 돈과 관계가 따로 놀지 않고 하나의 생활 질서 안으로 들어옵니다.`
  ];

  const expertQuestionAnswers = report.questionAnswers.map((qa, index) => ({
    ...qa,
    title: index === 0 ? `첫 번째 질문 핵심 판정: ${qa.title}` : `두 번째 질문 핵심 판정: ${qa.title}`,
    analysis: `${qa.analysis} 이 답변에서 중요한 근거는 ${report.dayMaster} 일간의 판단 방식, ${report.currentDayun.name} 대운의 압력, 그리고 ${dominantLabel} 흐름이 만드는 현실 반응입니다. 단순히 좋다/나쁘다로 끝내면 고객이 실제 선택을 할 수 없기 때문에, 운월당은 이 질문을 “지금 움직일 것, 확인할 것, 미뤄야 할 것”으로 나누어 봅니다. 지금은 말보다 행동의 흔적을 보는 편이 정확합니다. 상대나 시장의 반응, 반복되는 지출, 약속을 지키는 속도, 내 체력의 남는 정도까지 함께 확인하면 이 질문의 답이 훨씬 선명해집니다.`,
    advice: [
      `이 질문은 결론부터 정하지 말고 7일 안에 확인 가능한 행동 하나로 검증하세요. 연락, 제안서, 가격표, 일정표처럼 눈에 보이는 형태가 좋습니다.`,
      `상대나 상황의 말보다 반복 행동을 보세요. 약속 시간, 답변 속도, 돈을 쓰는 방식, 책임을 나누는 태도가 실제 운의 방향을 보여줍니다.`,
      `${bestMonth ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 전후에는 실행을 열고` : '운이 강한 구간에는 실행을 열고'}, ${watchMonth ? `${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} 전후에는 무리한 확정을 피하세요.` : '운이 약한 구간에는 무리한 확정을 피하세요.'}`,
      `마지막 판단 기준은 “좋아 보이는가”가 아니라 “내 일정, 돈, 마음, 체력을 망가뜨리지 않고 지속 가능한가”입니다.`
    ]
  }));

  const expertSections = report.sections.map((section) => {
    if (section.id === 'love') {
      return {
        ...section,
        subtitle: section.subtitle || '감정의 설렘보다 오래 가는 관계의 조건을 현실적으로 읽습니다.',
        callout: {
          title: '연애운 핵심 판정',
          body: `${report.customerName}님의 연애운은 강한 끌림만으로 결정되지 않습니다. 안정적으로 오래 가는 인연은 말이 많은 사람보다 생활 리듬, 연락 온도, 책임감, 돈과 시간의 태도가 일정한 사람 쪽에 가깝습니다. 처음부터 뜨겁게 몰아치는 관계보다 천천히 신뢰가 쌓이는 관계가 더 좋은 결과로 이어질 가능성이 큽니다.`
        },
        cards: [
          {
            title: '끌리는 사람의 공통점',
            body: '차분해 보이지만 자기 기준이 있고, 말보다 행동으로 신뢰를 주는 사람에게 마음이 움직이기 쉽습니다. 다만 무심함과 안정감을 혼동하면 기다림이 길어질 수 있습니다.',
            badge: 'attraction'
          },
          {
            title: '오래 가는 관계 조건',
            body: '연락 빈도보다 약속을 지키는 태도, 감정 표현보다 생활 배려가 중요합니다. 서로의 하루를 방해하지 않으면서도 필요한 순간에는 분명히 곁에 있는 사람이 잘 맞습니다.',
            badge: 'long-term'
          },
          {
            title: '관계가 흔들리는 지점',
            body: '상대가 애매하게 굴 때 바로 결론을 내리거나, 반대로 너무 오래 참다가 한 번에 끊어내는 패턴을 조심해야 합니다. 감정이 커질수록 확인 질문을 짧고 분명하게 하는 편이 좋습니다.',
            badge: 'caution'
          },
          {
            title: '30일 행동',
            body: '새로운 만남은 반복적으로 마주치는 생활권, 지인 소개, 일과 연결된 자리에서 열기 좋습니다. 연락은 길게 설명하기보다 약속 가능한 날짜와 구체적인 제안을 먼저 던지세요.',
            badge: 'action'
          }
        ],
        details: [
          ...(section.details || []),
          {
            summary: '상대가 보는 나의 분위기',
            content: `${report.customerName}님은 쉽게 가벼워 보이는 타입보다, 처음에는 조심스럽지만 가까워질수록 믿을 수 있는 사람으로 읽힙니다. 다만 감정을 감추는 시간이 길어지면 상대는 관심이 없는 것으로 오해할 수 있으니, 호감이 있다면 작은 표현을 늦추지 않는 편이 좋습니다.`,
            open: true
          },
          {
            summary: '피해야 할 인연과 놓치면 아까운 인연',
            content: `피해야 할 인연은 말은 달콤하지만 일정과 책임이 흐린 사람입니다. 놓치면 아까운 인연은 속도는 느려도 약속을 지키고, 돈과 시간의 태도가 깨끗하며, 갈등이 생겼을 때 회피하지 않고 대화하는 사람입니다.`,
            open: true
          }
        ]
      };
    }

    return {
      ...section,
      paragraphs: section.paragraphs?.map((paragraph) =>
        `${paragraph} 이 대목은 단순한 설명이 아니라 실제 선택 기준으로 써야 합니다. 좋은 흐름은 생활 속에서 반복될 때 힘을 얻고, 약한 흐름은 미리 분리해서 관리할 때 손실이 줄어듭니다.`
      )
    };
  });

  const expertCheckSection: ReportSection = {
    id: 'expert-check',
    title: '전문가 검증 포인트',
    subtitle: '결론을 믿기 전에 반드시 확인해야 할 근거를 따로 정리했습니다.',
    callout: {
      title: '왜 이 결론이 나왔는가',
      body: `이 리포트는 입력한 생년월일, 출생시간, 원국, 오행 분포, 십성 흐름, ${report.currentDayun.name} 대운, 연운과 월운을 함께 놓고 해석합니다. 단정적인 사건 예언보다 실제 선택에 도움이 되는 판단 기준을 우선합니다.`
    },
    cards: [
      {
        title: '명식 근거',
        body: `${report.dayMaster} 일간과 ${report.strengthLabel} 흐름을 중심으로, 강한 ${strongestLabel} 기운과 보완이 필요한 ${weakestLabel} 기운의 균형을 봅니다.`,
        tone: 'good'
      },
      {
        title: '운의 근거',
        body: `${report.currentDayun.name} 대운은 ${report.currentDayun.focus} 쪽을 밀어주지만, ${report.currentDayun.caution}는 반드시 관리해야 할 변수입니다.`
      },
      {
        title: '현실 검증',
        body: '좋은 운도 일정, 가격, 관계 태도, 체력 관리가 무너지면 체감되지 않습니다. 그래서 모든 조언은 행동으로 확인 가능한 기준으로 번역했습니다.'
      },
      {
        title: '단정 금지',
        body: '배우자, 질병, 사고, 투자 성과처럼 삶을 크게 흔드는 사건은 확정적으로 말하지 않습니다. 대신 위험 신호와 선택 기준을 알려드립니다.',
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '고객이 다시 봐야 할 체크리스트',
        content: `1. 지금 가장 강한 선택지가 내 체력을 망가뜨리지 않는가\n\n2. 돈이 들어오는 일인지, 돈이 남는 일인지 구분했는가\n\n3. 관계에서 말보다 반복 행동을 확인했는가\n\n4. 좋은 달에는 열고 약한 달에는 정리하는 리듬을 지키고 있는가`,
        open: true
      }
    ]
  };

  return {
    ...report,
    heroNote: `${report.customerName}님의 원국, 대운, 세운, 월운, 질문 맥락을 함께 검토한 프리미엄 상담형 리포트입니다. 단순한 위로보다 실제 선택에 도움이 되는 근거와 행동 기준을 우선했습니다.`,
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 핵심 판정`,
      analysis: expertSummary,
      advice: [
        `오늘 바로 할 일은 한 가지입니다. 지금 가장 중요한 선택을 “돈, 일정, 사람, 체력” 네 칸으로 나누어 적고, 빠진 칸이 있으면 아직 확정하지 마세요.`,
        `${helpfulText} 기운을 살리려면 생활 리듬을 먼저 고정하세요. 수면, 식사, 이동, 업무 시작 시간을 일정하게 잡는 것이 운을 받는 그릇이 됩니다.`,
        `${cautiousText} 기운이 과열될 때는 말과 결정을 늦춰야 합니다. 중요한 답변은 하루 뒤 다시 읽고 보내는 편이 손실을 줄입니다.`,
        `일과 돈은 감이 아니라 숫자로 보세요. 가격표, 반복 매출, 정산일, 제공 범위, 취소 조건을 정리하면 좋은 운이 실제 결과로 남습니다.`,
        `관계는 설렘보다 회복력을 보세요. 다툰 뒤 말투가 어떻게 돌아오는지, 약속을 어떻게 다시 맞추는지가 오래 갈 사람을 보여줍니다.`
      ]
    },
    keyTakeaways: [
      {
        title: '핵심',
        body: `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운의 결합상, 지금은 넓히는 운보다 정리해서 크게 만드는 운에 가깝습니다.`,
        tone: 'good'
      },
      {
        title: '일',
        body: '성과는 많이 벌리는 데서보다 역할 분리, 제공 범위, 마감 습관, 고객 응대 기준을 세울 때 커집니다.'
      },
      {
        title: '돈',
        body: '재물운은 수입보다 남는 구조가 핵심입니다. 가격, 정산, 반복 구매, 환불 조건을 정리하면 안정감이 올라갑니다.',
        tone: 'good'
      },
      {
        title: '관계',
        body: '오래 가는 인연은 말보다 반복 행동에서 드러납니다. 연락 온도, 약속 태도, 갈등 후 회복 방식을 보세요.'
      },
      {
        title: '주의',
        body: `${cautiousText} 기운이 과하면 판단이 빨라지고 체력 소모가 커질 수 있습니다. 큰 결정은 하루 더 두고 보세요.`,
        tone: 'warn'
      },
      {
        title: '시기',
        body: bestMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 전후에는 실행과 공개에 힘을 싣고, 약한 달에는 정리와 회복을 우선하세요.`
          : '강한 달에는 실행하고 약한 달에는 정리하는 방식으로 운의 리듬을 나누는 편이 좋습니다.'
      }
    ],
    questionAnswers: expertQuestionAnswers,
    sections: [expertCheckSection, ...expertSections],
    actionPlan: {
      ...report.actionPlan,
      title: '30일 실행 전략',
      priorities: [
        '1주차: 지금 진행 중인 일과 관계를 돈, 일정, 책임, 체력 네 칸으로 나누어 정리합니다.',
        '2주차: 가장 중요한 제안 하나만 골라 가격표, 제공 범위, 마감일을 문서로 고정합니다.',
        '3주차: 관계에서는 말보다 반복 행동을 확인하고, 애매한 약속은 짧고 분명하게 다시 묻습니다.',
        '4주차: 결과가 난 것은 유지하고, 피로만 남긴 선택은 과감히 줄여 다음 달 운을 받을 공간을 만듭니다.'
      ],
      dos: [
        '중요한 결정은 일정표와 숫자로 확인한 뒤 확정하기',
        '좋은 제안일수록 책임 범위와 취소 조건을 먼저 확인하기',
        '관계에서는 감정 설명보다 구체적인 약속을 제안하기',
        '몸이 무거운 날에는 일을 늘리지 말고 정리와 회복에 쓰기'
      ],
      avoids: [
        '상대의 말만 믿고 일정이나 돈을 먼저 열어두는 것',
        '기회가 아깝다는 이유로 체력 한계를 무시하는 것',
        '불안할 때 긴 메시지로 감정을 한 번에 쏟아내는 것',
        '가격, 역할, 마감이 흐린 일을 좋은 인연이나 좋은 기회로 착각하는 것'
      ]
    },
    legalNotice: [
      ...report.legalNotice,
      '본 리포트는 입력값과 명리학적 해석을 바탕으로 한 상담형 콘텐츠이며, 질병 진단, 투자 판단, 법률 판단, 특정 사건의 확정 예언으로 사용해서는 안 됩니다.'
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
  const report = useMemo(() => buildExpertSatisfactionReport(buildExpandedCoreReport(baseReport)), [baseReport]);
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

                <PremiumMonthCalendar report={report} />
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
