import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Download, Share2, User } from 'lucide-react';
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
  const totalValue = Math.max(report.fiveElements.reduce((sum, item) => sum + item.value, 0), 1);
  const maxValue = Math.max(...report.fiveElements.map((item) => item.value));
  const minValue = Math.min(...report.fiveElements.map((item) => item.value));
  const strongestItems = report.fiveElements.filter((item) => item.value === maxValue);
  const weakestItems = report.fiveElements.filter((item) => item.value === minValue);
  const balanceLabel =
    strongestItems.length > 1 && weakestItems.some((item) => item.value === 0)
      ? `${weakestItems.map((item) => item.label).join(', ')} 결핍 · 나머지 균등`
      : strongestItems.length > 1
        ? `${strongestItems.map((item) => item.label).join(', ')} 균등 우세`
        : `${strongestItems[0]?.label || '오행'} 중심 · ${weakestItems.map((item) => item.label).join(', ')} 보완`;
  const getElementReading = (value: number) => {
    const ratio = (value / totalValue) * 100;

    if (value === 0 || ratio < 8) {
      return '매우 부족';
    }
    if (ratio < 18) {
      return '부족';
    }
    if (ratio < 28) {
      return '보통';
    }
    if (ratio < 38) {
      return '강한 편';
    }

    return '매우 강함';
  };

  return (
    <article className="premium-distribution-card premium-element-compass">
      <div className="premium-distribution-head">
        <span>五行</span>
        <h3>오행 분포</h3>
      </div>
      <div className="premium-element-compass-core">
        <span>총 {totalValue}칸 기준</span>
        <strong>{balanceLabel}</strong>
        <em>천간과 지지를 합산한 실제 분포입니다.</em>
      </div>
      <div className="premium-element-medallions">
        {report.fiveElements.map((item, index) => (
          <div
            key={item.label}
            className={item.value === 0 ? 'premium-element-medallion empty' : 'premium-element-medallion'}
            style={
              {
                '--element-color': item.color,
                '--element-level': `${Math.max(14, (item.value / totalValue) * 100)}%`,
                '--element-index': index + 1
              } as React.CSSProperties & Record<'--element-index', number>
            }
          >
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <em>{Math.round((item.value / totalValue) * 100)}%</em>
            <small>{getElementReading(item.value)}</small>
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
            {item.ganzhi} · {getLuckPhase(item.score)}
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
          <strong>{getLuckPhase(item.score)}</strong>
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
            {item.ganzhi} · {getLuckPhase(item.score)}
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
          <strong>{getLuckPhase(item.score)}</strong>
        </article>
      ))}
    </div>
  );
}

void DayunCards;
void FortuneTimeline;
void MonthRibbon;

function getLuckPhase(score: number) {
  if (score >= 82) return '공개기';
  if (score >= 70) return '확장기';
  if (score >= 58) return '조율기';
  if (score >= 45) return '정비기';
  return '회복기';
}

function getLuckAction(score: number) {
  if (score >= 82) return '준비한 결과물을 밖으로 꺼내고 사람의 반응을 확인할 때';
  if (score >= 70) return '제안, 협업, 이동, 홍보를 작게라도 열어볼 때';
  if (score >= 58) return '두 선택지를 비교하고 방향을 다듬을 때';
  if (score >= 45) return '돈, 일정, 관계 조건을 다시 맞출 때';
  return '무리한 확정보다 체력과 손실을 먼저 막을 때';
}

function buildMyeongriClimate(report: SajuReportData) {
  const pillars = [report.pillars.year, report.pillars.month, report.pillars.day, report.pillars.hour || ''].join(' ');
  const monthBranch = report.pillars.month.slice(-1);
  const hasGeumSeason = monthBranch === '申' || monthBranch === '酉';
  const hasWaterRoot = /子|亥/.test(pillars);
  const hasFireRoot = /巳|午|丁|丙/.test(pillars);
  const hasWoodRoot = /寅|卯|甲|乙/.test(pillars);
  const isMuEarth = report.dayMaster === '무' || report.dayMaster === '戊';
  const strongest = [...report.fiveElements].sort((left, right) => right.value - left.value)[0]?.label || '강한 오행';
  const weakest = [...report.fiveElements].sort((left, right) => left.value - right.value)[0]?.label || '약한 오행';

  return {
    monthBasis: hasGeumSeason
      ? `${report.pillars.month} 월주는 금기가 왕한 절기 흐름입니다. 월령이 금 쪽으로 기울면 생각, 판단, 계산, 결과물에 대한 기준이 날카로워집니다.`
      : `${report.pillars.month} 월령은 이 명식의 계절 배경입니다. 같은 오행 숫자라도 월령을 얻은 기운은 실제 체감에서 더 크게 작동합니다.`,
    johu: hasGeumSeason && hasWaterRoot
      ? `금수 기운이 함께 살아나면 명식이 차갑게 굳기 쉽습니다. 이때 화는 단순한 보완 오행이 아니라, 판단을 사람의 온도와 실행력으로 데워주는 조후의 역할을 합니다.`
      : hasFireRoot
        ? `화 기운은 이 명식에서 생각을 행동으로 옮기게 하는 온도입니다. 마음속 결론을 현실 일정으로 바꾸려면 화의 리듬이 필요합니다.`
        : `${report.helpfulElements[0] || '희신'} 기운은 명식의 온도와 방향을 맞추는 보조축입니다. 부족하면 판단은 있어도 실행의 열기가 늦게 붙습니다.`,
    wood: hasWoodRoot
      ? `목 기운은 관계의 방향과 성장 의지를 열어주는 통로입니다. 살아 있을 때는 배우고 연결하고 새 판을 만드는 감각이 생깁니다.`
      : `목 기운이 약하게 보이면 단순히 추진력이 없다는 뜻이 아닙니다. 관계에서 어디까지 다가가고 어디서 선을 그을지, 성장 방향을 정하는 감각을 의식적으로 만들어야 합니다.`,
    dayMaster: isMuEarth
      ? `무토 일간은 넓은 땅처럼 판을 크게 보고 버티는 힘이 있지만, 금수 한기가 강하면 땅이 차갑게 굳어 혼자 책임을 안고 버티는 쪽으로 흐르기 쉽습니다.`
      : `${report.dayMaster} 일간은 결정을 내리는 중심입니다. 일간이 월령과 대운을 어떻게 받는지에 따라 같은 사건도 기회나 부담으로 다르게 체감됩니다.`,
    elementReading: `${strongest}이 강하게 잡히고 ${weakest}이 약하게 잡히더라도, 숫자만으로 균형을 말하면 부족합니다. 월령, 지지의 뿌리, 천간에 드러난 기운, 합충으로 움직이는 방향까지 함께 봐야 실제 체감이 맞습니다.`
  };
}

function describeTenGodDepth(label: string, report: SajuReportData) {
  if (label.includes('식') || label.includes('상')) {
    return `${label}은 말, 콘텐츠, 설명, 상담, 설계 능력으로 드러납니다. ${report.dayMaster} 일간이 가진 기준을 고객이 이해할 수 있는 언어로 바꾸는 힘이라, 리포트·강의·상담·기획형 상품과 잘 맞습니다.`;
  }
  if (label.includes('재')) {
    return `${label}은 돈 자체보다 시장, 고객, 거래, 선택지의 흐름을 읽는 감각입니다. 잘 쓰면 다중 수익과 판매 감각이 살아나지만, 무리하면 약속과 지출이 동시에 늘어납니다.`;
  }
  if (label.includes('비') || label.includes('겁')) {
    return `${label}은 자기 기준과 독립성을 세우는 힘입니다. 장점으로 쓰이면 흔들리지 않는 중심이 되지만, 피곤할 때는 타인의 방식까지 내 기준에 맞추려는 압박으로 나타날 수 있습니다.`;
  }
  if (label.includes('관')) {
    return `${label}은 책임, 직함, 규칙, 사회적 신뢰와 연결됩니다. 계약, 심사, 제도, 직업 안정성이 중요한 선택일수록 이 기운을 섬세하게 봐야 합니다.`;
  }
  if (label.includes('인')) {
    return `${label}은 공부, 보호, 자격, 문서, 회복의 힘입니다. 급하게 벌리는 일보다 준비와 검증을 거친 선택에서 신뢰가 살아납니다.`;
  }
  return `${label}은 이 명식에서 반복되는 행동 방식과 선택 습관을 보여주는 십성입니다. 점수보다 어떤 장면에서 켜지는지를 봐야 실제 해석이 깊어집니다.`;
}

function formatCautionElements(report: SajuReportData) {
  const active = report.cautiousElements.filter((element) => (report.fiveElements.find((item) => item.label === element)?.value || 0) > 0);
  const missing = report.cautiousElements.filter((element) => (report.fiveElements.find((item) => item.label === element)?.value || 0) === 0);

  if (active.length > 0 && missing.length > 0) {
    return `${active.join(', ')} 기운은 강해질 때 속도와 부담을 만들 수 있고, ${missing.join(', ')} 기운은 과다가 아니라 부족할 때 관계 방향과 성장감이 비기 쉬운 자리입니다.`;
  }

  if (missing.length > 0) {
    return `${missing.join(', ')} 기운은 과다보다 결핍을 보완해야 하는 자리입니다. 관계의 방향, 다음 단계 제안, 성장 동선을 의식적으로 만들어야 합니다.`;
  }

  return `${active.join(', ')} 기운은 강해질 때 속도, 지출, 감정 반응이 같이 커질 수 있습니다.`;
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
          : '두 번째 질문이 비어 있다면, 올해는 관계보다 일의 흐름과 체력 리듬을 먼저 안정시키는 쪽이 우선입니다.'
      ],
      advice: [
        `${report.helpfulElements.join(', ')} 흐름을 살리는 생활 리듬을 하나 정하세요. 수면, 운동, 업무 시작 시간처럼 몸이 따라오는 루틴이어야 합니다.`,
        `일과 돈은 한 장짜리 운영표로 관리하세요. 가격 기준, 제공 범위, 마감일, 수정 횟수, 책임자를 적어두는 것만으로도 운의 누수가 줄어듭니다.`,
        `좋은 제안이 들어와도 바로 받지 말고, 지금 대운의 주제인 "${report.currentDayun.focus}"와 맞는지 확인하세요. 맞지 않는 제안은 기회처럼 보여도 체력을 먼저 씁니다.`,
        bestMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} ${getLuckPhase(bestMonth.score)}에는 제안과 실행을, ${getLuckPhase(watchMonth?.score || 50)}에는 정산과 수정에 힘을 쓰세요.`
          : '운이 강한 구간에는 실행을, 약한 구간에는 정비를 우선하세요.',
        `관계는 설렘보다 장면을 보세요. 약속 시간, 돈 쓰는 태도, 갈등 후 말투, 바쁠 때의 배려가 오래 갈 인연인지 알려줍니다.`
      ]
    },
    keyTakeaways: [
      {
        title: '핵심',
        body: `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운이 만나는 지금은 판을 키우기보다 책임 범위와 돈의 흐름을 먼저 다듬어야 할 때입니다.`,
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
  const cautionGuidance = formatCautionElements(report);
  const strongestLabel = strongestElement?.label || report.helpfulElements[0];
  const weakestLabel = weakestElement?.label || report.cautiousElements[0];
  const dominantLabel = dominantTenGod?.label || '주요 십성';
  const secondLabel = secondTenGod?.label || '보조 십성';
  const climate = buildMyeongriClimate(report);
  const lifeGraphYears = report.yearLuck.slice(0, 5);
  const highYears = lifeGraphYears.filter((item) => item.score >= 80);
  const lowYears = lifeGraphYears.filter((item) => item.score < 55);
  const firstHighYear = highYears[0] || lifeGraphYears[0];
  const firstLowYear = lowYears[0] || lifeGraphYears[lifeGraphYears.length - 1];
  const careerMode =
    dominantLabel.includes('식') || dominantLabel.includes('상')
      ? '콘텐츠형, 설명형, 상담형, 교육형 상품'
      : dominantLabel.includes('재')
        ? '매출형, 영업형, 거래형, 패키지 상품'
        : dominantLabel.includes('관')
          ? '전문직형, 관리형, 조직 신뢰형 서비스'
          : '1인 브랜드형, 운영 설계형, 반복 관리형 서비스';
  const customerType =
    dominantLabel.includes('재')
      ? '결과와 가격을 분명히 비교하는 실속형 고객'
      : dominantLabel.includes('식') || dominantLabel.includes('상')
        ? '설명을 충분히 듣고 납득한 뒤 구매하는 이해형 고객'
        : '신뢰, 꾸준함, 책임감을 보고 오래 맡기는 안정형 고객';
  const relationshipMoneyLink =
    report.helpfulElements.includes('토') || report.helpfulElements.includes('화')
      ? '약속을 지키고 반복적으로 만나는 관계, 소개와 추천으로 이어지는 관계'
      : '정보를 나누고 기회를 연결해 주는 관계';

  const expertSummary = [
    `${report.customerName}님의 명식은 일간 ${report.dayMaster}, ${report.pillars.month} 월령, 현재 ${report.currentDayun.name} 대운을 같이 놓아야 결론이 또렷해집니다. ${climate.dayMaster} 그래서 이 사주는 단순히 “열심히 하면 된다”보다, 차가워진 판단을 어느 장면에서 데우고 어떤 관계에서 흘려보낼지를 보는 쪽이 정확합니다.`,
    `${climate.monthBasis} ${climate.johu} 오행 표가 비슷해 보여도 월령을 얻은 기운과 지지에 뿌리내린 기운은 체감 무게가 다릅니다.`,
    `${climate.wood} 이 부분이 약하면 사람을 싫어해서가 아니라, 관계의 방향이 흐릴 때 갑자기 피로가 올라옵니다. 그래서 애매한 약속, 말만 많은 제안, 끝이 보이지 않는 관계에서 먼저 지칩니다.`,
    `십성에서는 ${dominantLabel}과 ${secondLabel}의 조합을 봐야 합니다. ${describeTenGodDepth(dominantLabel, report)} ${describeTenGodDepth(secondLabel, report)}`,
    `${report.currentDayun.name} 대운은 "${report.currentDayun.focus}" 쪽을 강하게 건드립니다. 특히 재성이나 수 기운이 활성화되는 대운에서는 고객, 돈, 이동, 관계의 양이 늘 수 있지만, 그만큼 책임과 지출도 같이 따라옵니다. ${report.currentDayun.caution}`,
    currentYear
      ? `${currentYear.year}년은 "${currentYear.headline}"의 해로 읽힙니다. 집중 포인트는 ${currentYear.focus}이고, 주의할 점은 ${currentYear.warning}입니다. 이 해는 사건 하나를 맞히는 방식보다, 어떤 선택지가 실제로 사람·돈·일정의 변화를 부르는지 관찰해야 합니다.`
      : `${report.customerName}님에게 올해 필요한 태도는 빠른 확정보다 검증입니다. 감정적으로 끌리는 선택이라도 일정, 비용, 사람의 태도, 내 체력까지 확인한 뒤 움직일 때 손실이 줄어듭니다.`,
    bestMonth && watchMonth
      ? `가까운 월운은 숫자 점수보다 단계로 보는 편이 안전합니다. ${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')}은 ${getLuckPhase(bestMonth.score)}라 ${getLuckAction(bestMonth.score)}이고, ${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')}은 ${getLuckPhase(watchMonth.score)}라 ${getLuckAction(watchMonth.score)}입니다.`
      : `월운은 좋고 나쁨의 점수보다 확장기, 조율기, 정비기처럼 역할을 나눠 읽어야 합니다. 그래야 고객이 “왜 그 달에 그런 일이 생기는지”를 납득할 수 있습니다.`,
    `종합하면 이 사주의 핵심은 금수의 냉정함을 결과물과 계산력으로 쓰되, 화의 온도와 목의 방향성을 잃지 않는 것입니다. ${helpfulText}은 살리고, ${cautionGuidance} 좋은 운이 자기계발 문장이 아니라 실제 생활 장면으로 내려옵니다.`
  ];

  const expertQuestionAnswers = report.questionAnswers.map((qa, index) => ({
    ...qa,
    title: index === 0 ? `첫 번째 질문 핵심 판정: ${qa.title}` : `두 번째 질문 핵심 판정: ${qa.title}`,
    analysis: `${qa.analysis} 이 답변의 명리 근거는 ${report.dayMaster} 일간, ${report.pillars.month} 월령, ${report.currentDayun.name} 대운, 그리고 ${dominantLabel} 흐름이 함께 만드는 현실 반응입니다. 좋다/나쁘다보다 먼저 볼 것은 실제 사건의 흔적입니다. 상대나 시장의 반응, 반복되는 지출, 약속을 지키는 속도, 내 체력의 남는 정도까지 보면 이 질문의 답이 훨씬 선명해집니다.`,
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
      paragraphs: section.paragraphs?.map((paragraph, index) => {
        const bases = [
          `명리적으로는 ${report.pillars.month} 월령과 ${report.dayMaster} 일간의 관계를 함께 봐야 이 문장이 현실성을 얻습니다.`,
          `${report.currentDayun.name} 대운에서는 같은 선택도 사람, 돈, 이동의 압력으로 체감될 수 있어 조건 확인이 중요합니다.`,
          `${dominantLabel} 흐름이 강하게 켜질 때는 말보다 결과물, 반복 행동, 실제 비용에서 답이 드러납니다.`,
          `${climate.johu}`
        ];
        return `${paragraph} ${bases[index % bases.length]}`;
      })
    };
  });

  const myeongriBasisSection: ReportSection = {
    id: 'myeongri-basis',
    title: '명리 근거 해설',
    subtitle: '오행 숫자만 보지 않고 월령, 조후, 십성, 대운을 함께 읽습니다.',
    callout: {
      title: '왜 이 사주는 이렇게 읽히는가',
      body: `${climate.monthBasis} ${climate.elementReading}`
    },
    cards: [
      {
        title: '월령과 계절감',
        body: climate.monthBasis,
        tone: 'good'
      },
      {
        title: '조후와 화의 역할',
        body: climate.johu,
        tone: 'good'
      },
      {
        title: '목 기운의 실제 의미',
        body: climate.wood
      },
      {
        title: '무토 일간의 체감',
        body: climate.dayMaster
      },
      {
        title: `${dominantLabel} 해석`,
        body: describeTenGodDepth(dominantLabel, report)
      },
      {
        title: `${secondLabel} 해석`,
        body: describeTenGodDepth(secondLabel, report)
      }
    ],
    details: [
      {
        summary: '오행 비율을 그대로 믿으면 안 되는 이유',
        content: `오행 표는 입구일 뿐입니다. 같은 25%라도 월령을 얻었는지, 지지에 뿌리가 있는지, 천간에 드러났는지, 대운·세운에서 다시 자극되는지에 따라 체감은 완전히 달라집니다.\n\n그래서 운월당 리포트는 오행 숫자를 보여주되, 결론은 월령·조후·십성·대운을 함께 놓고 냅니다.`,
        open: true
      }
    ]
  };

  const lifeGraphSection: ReportSection = {
    id: 'life-graph',
    title: '인생 그래프',
    subtitle: '연도별 흐름을 단계와 실제 인생 장면 중심으로 읽었습니다.',
    callout: {
      title: '그래프 핵심',
      body: `${report.customerName}님의 가까운 흐름은 ${firstHighYear?.year || '공개기'} 전후에 실행감이 살아나고, ${firstLowYear?.year || '정비기'} 전후에는 속도보다 정리와 회복이 중요해지는 모양입니다. 이 그래프는 사건을 단정하기보다 어느 해에 관계, 일, 돈의 압력이 먼저 켜지는지 보여줍니다.`
    },
    cards: lifeGraphYears.map((item) => ({
      title: `${item.year}년 · ${getLuckPhase(item.score)}`,
      body: `${item.headline}. ${item.ganzhi} 세운이 ${report.currentDayun.name} 대운과 만나 ${item.focus} 흐름을 자극합니다. 이 구간은 ${getLuckAction(item.score)}이며, ${item.warning}`,
      tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
    })),
    details: [
      {
        summary: '그래프를 읽는 법',
        content: `공개기는 무조건 좋은 일만 생긴다는 뜻이 아닙니다. 준비한 일을 밖으로 꺼내고, 사람을 만나고, 반응을 확인하기 좋은 구간입니다.\n\n정비기와 회복기는 실패의 표시가 아니라 비용 점검, 관계 재편, 체력 회복을 통해 다음 흐름을 받을 공간을 만드는 시간입니다.`,
        open: true
      }
    ]
  };

  const eventTimelineSection: ReportSection = {
    id: 'event-timeline',
    title: '사건 타임라인',
    subtitle: '언제 무엇이 왜 움직일 수 있는지 시기별로 압축했습니다.',
    cards: lifeGraphYears.map((item, index) => {
      const eventTitle =
        item.score >= 80
          ? '성과 공개와 관계 확장 가능성'
          : item.score < 55
            ? '정리, 거리두기, 재정비 가능성'
            : index <= 1
              ? '방향 조정과 선택지 비교'
              : '직업 방식과 돈의 흐름 재설계';

      return {
        title: `${item.year}년 · ${eventTitle}`,
        body: `${item.ganzhi} 세운은 ${item.summary} 그래서 이 시기에는 ${item.focus}가 실제 사건의 중심이 되기 쉽습니다. 반대로 ${item.warning}를 무시하면 사람, 돈, 일정 중 하나에서 피로가 먼저 올라올 수 있습니다.`,
        tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
      };
    }),
    table: {
      headers: ['시기', '발생 가능 장면', '왜 그런가', '대응'],
      rows: lifeGraphYears.map((item) => [
        `${item.year}년`,
        getLuckPhase(item.score),
        `${item.ganzhi} 흐름과 ${report.currentDayun.name} 대운의 결합`,
        getLuckAction(item.score)
      ])
    }
  };

  const yongsinSection: ReportSection = {
    id: 'yongsin',
    title: '용신·희신 분석',
    subtitle: '왜 어떤 기운은 필요하고 어떤 기운은 과하면 흔들리는지 설명합니다.',
    callout: {
      title: `${helpfulText} 기운을 살리는 이유`,
      body: `${report.customerName}님은 ${report.strengthLabel} 흐름으로 읽히며, ${climate.johu} 용신·희신은 행운의 색깔이 아니라 월령과 조후의 치우침을 현실에서 바로잡는 균형추입니다.`
    },
    cards: [
      {
        title: '용신 방향',
        body: `${report.helpfulElements[0] || helpfulText} 기운은 명식의 중심을 세우는 축입니다. 이 기운은 추상적인 행운보다 수면, 식사, 마감, 공간 정리, 가격표처럼 몸과 현실을 안정시키는 방식으로 써야 살아납니다.`,
        tone: 'good'
      },
      {
        title: '희신 방향',
        body: `${report.helpfulElements[1] || report.helpfulElements[0] || helpfulText} 기운은 용신이 움직이도록 불을 붙이는 보조 에너지입니다. 사람 앞에 나서기, 결과물을 보여주기, 따뜻한 설득, 꾸준한 홍보와 잘 맞습니다.`,
        tone: 'good'
      },
      {
        title: `${weakestLabel} 부족의 실제 체감`,
        body: `${weakestLabel} 기운이 약하면 해당 영역은 처음부터 없는 것이 아니라 의식적으로 챙기지 않으면 비어 보입니다. 특히 관계 방향, 말의 온도, 다음 단계 제안이 늦어질 때 고객이나 상대가 확신을 잃을 수 있습니다.`
      },
      {
        title: `${cautiousText} 과열 주의`,
        body: `${cautionGuidance} 이때는 결정보다 검증, 확장보다 회복이 먼저입니다.`,
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '용신·희신을 생활에서 쓰는 법',
        content: `1. 중요한 결정은 밤늦게 하지 않고 다음 날 오전에 다시 봅니다.\n\n2. 돈이 걸린 일은 가격, 범위, 마감, 수정 횟수를 먼저 적습니다.\n\n3. 관계에서는 감정 설명보다 약속 가능한 날짜와 행동을 먼저 제안합니다.\n\n4. 몸이 무거운 시기에는 운이 없는 것이 아니라 그릇이 좁아진 상태로 보고, 회복을 일정에 넣어야 합니다.`,
        open: true
      }
    ]
  };

  const careerDetailSection: ReportSection = {
    id: 'career-detail',
    title: '직업·사업 디테일',
    subtitle: '무엇을 팔고, 누구에게 팔고, 어떤 방식으로 돈을 남길지까지 봅니다.',
    callout: {
      title: '가장 잘 맞는 일의 모양',
      body: `${report.customerName}님에게 맞는 일은 막연한 사업보다 ${careerMode}에 가깝습니다. 혼자 시작하되, 반복되는 업무는 도구와 협업으로 분리하는 방식이 좋습니다.`
    },
    cards: [
      {
        title: '혼자 vs 팀',
        body: `초기에는 직접 해석하고 톤을 잡는 방식이 맞습니다. 다만 규모가 커질수록 상담, 제작, 정산, 고객 응대가 한 사람에게 몰리면 금수의 압박이 피로로 바뀌기 쉬우니 역할을 나눠야 합니다.`,
        tone: 'good'
      },
      {
        title: '온라인 vs 오프라인',
        body: `온라인에서는 리포트, 예약, 결제, 다시보기처럼 반복 가능한 구조가 좋고, 오프라인은 신뢰를 강화하는 보조 채널로 쓰는 편이 맞습니다.`
      },
      {
        title: '맞는 고객층',
        body: `${customerType}에게 강합니다. 감정만 자극하는 판매보다 “무엇을 받게 되는지”를 분명히 보여주는 상품 설명이 매출로 연결됩니다.`
      },
      {
        title: '수익 구조',
        body: `단건 결제만으로 끝내기보다 기본 리포트, 프리미엄 리포트, 월별 업데이트, 후속 질문 상품처럼 계단형 구조가 좋습니다. 돈은 첫 결제보다 재방문에서 안정됩니다.`,
        tone: 'good'
      },
      {
        title: '피해야 할 방식',
        body: `가격이 매번 달라지는 일, 역할이 섞인 동업, 소개받은 일이라 거절 못 하는 구조는 피로가 먼저 쌓입니다. 좋은 기회라도 조건이 흐리면 운을 소모합니다.`,
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '실제 실행 예시',
        content: `첫 화면에는 대표 상품 하나를 강하게 두고, 아래에 연애·재회·직업·재물처럼 고민별 입구를 나눕니다.\n\n상품 설명은 “사주를 봐드립니다”가 아니라 “올해 무엇을 줄이고 무엇을 키울지 정리해드립니다”처럼 결과 중심으로 써야 합니다.\n\n고객 응대는 상담자의 감에만 의존하지 말고 주문번호, 입력값, 질문, 생성일, 신고/수정 기록을 남기는 구조가 좋습니다.`,
        open: true
      }
    ]
  };

  const relationshipPatternSection: ReportSection = {
    id: 'relationship-pattern',
    title: '인간관계 실제 패턴',
    subtitle: '추상적인 관계운이 아니라 생활에서 반복되는 행동 장면으로 풉니다.',
    cards: [
      {
        title: '처음엔 좋은데 나중에 거리두는 이유',
        body: `${report.customerName}님은 처음에는 상대의 장점과 가능성을 크게 보지만, 시간이 지나며 약속, 돈, 말의 일관성이 어긋나면 마음속 기준선이 급격히 올라갑니다. 그래서 겉으로는 조용해 보여도 안에서는 이미 관계 정리가 시작될 수 있습니다.`
      },
      {
        title: '상대가 집착하거나 기대는 장면',
        body: `책임감 있게 받아주는 모습이 강하게 보이면, 상대는 “이 사람은 끝까지 들어준다”고 느끼기 쉽습니다. 문제는 그 기대가 커질수록 ${report.customerName}님이 피로를 숨기다가 한 번에 멀어질 수 있다는 점입니다.`,
        tone: 'warn'
      },
      {
        title: '피로하면 연락을 끊는 패턴',
        body: `몸과 일정이 밀리면 감정을 설명할 에너지가 줄어듭니다. 이때 답장을 미루는 것은 무관심이라기보다 관계를 망치지 않으려는 방어에 가깝지만, 상대는 거리두기로 받아들일 수 있습니다.`
      },
      {
        title: '돈을 가져오는 관계',
        body: `${relationshipMoneyLink}가 돈을 가져옵니다. 즉흥적으로 친한 관계보다 약속을 지키고 서로의 역할이 분명한 관계에서 소개, 계약, 재구매가 생기기 쉽습니다.`,
        tone: 'good'
      }
    ],
    details: [
      {
        summary: '관계에서 바로 써야 할 문장',
        content: `“지금 바로 결정하기보다 조건을 한 번 정리해서 답할게요.”\n\n“내가 가능한 범위는 여기까지고, 이 부분은 따로 맞춰야 해요.”\n\n“감정은 이해하지만 일정과 책임을 먼저 정해야 오래 갈 수 있어요.”\n\n이런 문장을 미리 준비해두면 관계를 끊지 않고도 경계를 세울 수 있습니다.`,
        open: true
      }
    ]
  };

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
        `${cautionGuidance} 중요한 답변은 하루 뒤 다시 읽고 보내는 편이 손실을 줄입니다.`,
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
        body: `${cautionGuidance} 큰 결정은 하루 더 두고 보세요.`,
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
    sections: [
      lifeGraphSection,
      myeongriBasisSection,
      eventTimelineSection,
      yongsinSection,
      careerDetailSection,
      relationshipPatternSection,
      expertCheckSection,
      ...expertSections
    ],
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

  const handlePrintReport = () => {
    window.print();
  };

  const handleShareReport = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `${report.customerName} ${report.title}`,
        text: '운월당 사주 리포트',
        url: window.location.href
      });
      return;
    }

    await navigator.clipboard?.writeText(window.location.href);
  };

  const issueMailHref = `mailto:250909bs@gmail.com?subject=${encodeURIComponent(
    `[운월당 리포트 신고] ${report.serialNumber}`
  )}&body=${encodeURIComponent(
    `리포트 번호: ${report.serialNumber}\n상품: ${report.title}\n이름: ${report.customerName}\n\n오타/불일치/개선이 필요한 부분을 적어주세요.\n`
  )}`;

  return (
    <main className={isYearlyShowcase ? 'premium-report-page yearly-premium-page' : 'premium-report-page'}>
      <header className="premium-report-topbar">
        <div className="premium-report-topbar-inner">
          <Link to="/" className="premium-report-brand" aria-label="운월당 홈">
            운월당
          </Link>

          <div className="premium-report-top-actions">
            <button type="button" className="premium-icon-action" aria-label="리포트 공유" onClick={handleShareReport}>
              <Share2 size={16} />
            </button>
            <button type="button" className="premium-icon-action" aria-label="PDF로 저장" onClick={handlePrintReport}>
              <Download size={16} />
            </button>
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
              {report.customerName} 종합사주 리포트
            </h1>

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
                          <span>{getLuckPhase(item.score)}</span>
                        </div>
                      ))}
                    </div>
                    <p>
                      {monthlyHotMonths[0]
                        ? `${monthlyHotMonths[0].year}.${String(monthlyHotMonths[0].month).padStart(2, '0')}은 ${getLuckPhase(monthlyHotMonths[0].score)}로, 움직임을 열어보기 좋은 구간입니다.`
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

            <div className="premium-report-support-card">
              <div>
                <strong>결과가 이상하거나 오타가 있나요?</strong>
                <p>리포트 번호와 함께 보내주시면 검수 기준에 따라 개선할 수 있습니다.</p>
              </div>
              <a href={issueMailHref} className="app-black-button">
                오타·불일치 신고
              </a>
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
