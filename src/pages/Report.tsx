import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Download, Share2, User, Volume2, VolumeX } from 'lucide-react';
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
  reportAccessToken?: string;
  reportData?: SajuReportData;
};

const createSafeReportFileName = (value: string) =>
  value
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'unwoldang-report';

const isMobileDownloadBrowser = () =>
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|SamsungBrowser|KAKAOTALK|NAVER|Line/i.test(navigator.userAgent);

const getCurrentPageCssText = () => {
  const collectedRules = Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from((sheet as CSSStyleSheet).cssRules)
          .map((rule) => rule.cssText)
          .join('\n');
      } catch {
        return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');

  const inlineStyles = Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent || '')
    .filter(Boolean)
    .join('\n\n');

  return [collectedRules, inlineStyles].filter(Boolean).join('\n\n');
};

const PREVIEW_FORM_DATA: Partial<IntakeFormData> = {
  name: '차민호',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'single',
  relationshipDuration: 'under3',
  q1: '지금 제 인생에서 가장 먼저 정리해야 할 흐름은 무엇인가요?',
  q2: '재물운과 직업운 중 어떤 쪽에 집중해야 하나요?'
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

function SajuWonGukReading({ report }: { report: SajuReportData }) {
  const dominantLabel = report.tenGods[0]?.label || '주요 십성';
  const secondLabel = report.tenGods[1]?.label || '보조 십성';
  const monthPillar = report.pillars.month || '월주';
  const dayPillar = report.pillars.day || '일주';
  const hourText = report.pillars.hour ? `시주 ${report.pillars.hour}까지 함께 보면` : '태어난 시간이 비어 있으면';

  return (
    <article className="premium-card premium-wonguk-reading-card">
      <span className="premium-wonguk-reading-kicker">원국 해설</span>
      <h3>
        {dayPillar} 일주와 {monthPillar} 월령을 먼저 봅니다
      </h3>
      <p>
        {report.customerName}님의 원국은 성격표가 아니라 반복되는 선택 습관을 보는 지도입니다. 일간 {report.dayMaster}은
        결정의 중심이고, {monthPillar} 월령은 사회에서 압박을 받는 방식입니다. 그래서 같은 질문도 월령과 일간을 같이 놓아야
        실제 체감에 가까워집니다.
      </p>
      <p>
        십성에서는 {dominantLabel}과 {secondLabel}이 앞에 보입니다. 이 조합은 말투, 책임 반응, 돈 쓰임, 관계 거리에서
        먼저 드러납니다. {hourText} 생활 리듬과 감정 회복 방식까지 더 촘촘하게 읽을 수 있습니다.
      </p>
      <p>
        현재 {report.currentDayun.name} 대운은 원국의 이 구조가 지금 현실에서 어디로 켜지는지를 보여줍니다. 그래서 아래
        리포트의 조언은 단순 성격 설명이 아니라, 원국이 대운을 만났을 때 실제로 생기는 선택 장면을 기준으로 풀었습니다.
      </p>
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

function getYearLuckPhase(item: SajuReportData['yearLuck'][number]) {
  if (item.ganzhi === '병오') return '공개기';
  if (item.ganzhi === '정미') return '현실화기';
  if (item.ganzhi === '무신') return '검증기';
  if (item.ganzhi === '기유') return '정산기';
  if (item.ganzhi === '경술') return '고정기';
  return getLuckPhase(item.score);
}

function getLuckAction(score: number) {
  if (score >= 82) return '준비한 결과물을 밖으로 꺼내고 사람의 반응을 확인할 때';
  if (score >= 70) return '제안, 협업, 이동, 홍보를 작게라도 열어볼 때';
  if (score >= 58) return '두 선택지를 비교하고 방향을 다듬을 때';
  if (score >= 45) return '돈, 일정, 관계 조건을 다시 맞출 때';
  return '무리한 결정보다 체력과 손실을 먼저 막을 때';
}

function getYearLuckAction(item: SajuReportData['yearLuck'][number]) {
  if (item.ganzhi === '병오') return '준비한 결과물을 밖으로 꺼내고 사람의 반응을 확인할 때';
  if (item.ganzhi === '정미') return '벌린 일을 고정하고 책임·고정비·생활 체력을 다시 맞출 때';
  if (item.ganzhi === '무신') return '감이 아니라 숫자, 결과물, 정산 구조로 성과를 검증할 때';
  if (item.ganzhi === '기유') return '평판, 후기, 반복 고객, 정산 기준을 세밀하게 다듬을 때';
  if (item.ganzhi === '경술') return '역할과 책임을 고정하고 오래 갈 구조만 남길 때';
  return getLuckAction(item.score);
}

function getYearEventTitle(item: SajuReportData['yearLuck'][number], index: number) {
  if (item.ganzhi === '병오') return '성과 공개와 반응 확인';
  if (item.ganzhi === '정미') return '정리, 고정, 현실화';
  if (item.ganzhi === '무신') return '결과물 검증과 수익 구조 점검';
  if (item.ganzhi === '기유') return '평판, 정산, 관계 선별';
  if (item.ganzhi === '경술') return '책임 고정과 기반 재정비';

  if (item.score >= 80) return '성과 공개와 관계 확장 가능성';
  if (item.score < 55) return '정리, 거리두기, 재정비 가능성';
  return index <= 1 ? '방향 조정과 선택지 비교' : '직업 방식과 돈의 흐름 재설계';
}

const BEST_MONTH_REASON_BY_MONTH: Record<number, string> = {
  1: '공개운',
  2: '정비운',
  3: '기준 정리운',
  4: '관계 조율운',
  5: '협업 조율운',
  6: '속도 조절운',
  7: '점검운',
  8: '정비 후 완성운',
  9: '관계 선별운',
  10: '확장운',
  11: '정산운',
  12: '마무리운'
};

function getBestMonthReason(item: SajuReportData['monthLuck'][number]) {
  return BEST_MONTH_REASON_BY_MONTH[item.month] || `${getLuckPhase(item.score)} 활용운`;
}

function formatBestMonthReasonList(items: SajuReportData['monthLuck']) {
  return items.map((item) => `${item.month}월 ${getBestMonthReason(item)}`).join(', ');
}

function formatElementLabels(items: Array<{ label: string }>) {
  return items.map((item) => item.label).join('·');
}

function buildYearlyElementRealityLine(report: SajuReportData, currentYear?: SajuReportData['yearLuck'][number]) {
  const values = report.fiveElements;
  const maxValue = Math.max(...values.map((item) => item.value));
  const strongestItems = values.filter((item) => item.value === maxValue && item.value > 0);
  const missingItems = values.filter((item) => item.value === 0);
  const visibleItems = values.filter((item) => item.value > 0);
  const parsedYear = parsePillar(currentYear?.ganzhi || null);
  const yearLabel = parsedYear && currentYear ? `${currentYear.year}년 ${parsedYear.stemHanja}${parsedYear.branchHanja}` : `${currentYear?.year || '올해'}`;
  const yearElementLine = parsedYear
    ? parsedYear.stemElement === parsedYear.branchElement
      ? `${yearLabel} 세운에서 천간과 지지 모두 ${parsedYear.stemElement} 기운이 강하게 드러납니다`
      : `${yearLabel} 세운에서 천간 ${parsedYear.stemElement}, 지지 ${parsedYear.branchElement} 기운이 함께 작동합니다`
    : `${yearLabel} 세운과 대운에서 체감 오행이 다시 켜집니다`;

  if (missingItems.length > 0 && strongestItems.length > 1) {
    return `오행 표만 보면 ${formatElementLabels(missingItems)}은 비고, ${formatElementLabels(visibleItems)}는 겉으로 균등합니다. 그래서 원국 숫자만 놓고 ${strongestItems[0]?.label || '특정 오행'}가 가장 크다고 말하면 맞지 않습니다. 다만 ${yearElementLine}. 세운과 대운에서 다시 자극되는 기운이 실제 생활에서는 더 크게 체감됩니다.`;
  }

  if (strongestItems.length > 1) {
    return `오행 표는 ${formatElementLabels(strongestItems)}가 같은 비중으로 잡힙니다. 한 오행이 혼자 가장 크다고 단정하기보다 월령, 지지의 뿌리, 대운과 세운에서 무엇이 다시 켜지는지를 봐야 합니다. ${yearElementLine}.`;
  }

  return `오행은 ${strongestItems[0]?.label || report.dayMasterElement} 기운이 눈에 띄지만, 결론은 숫자 하나로 끝내면 안 됩니다. 월령, 지지의 뿌리, 대운과 세운에서 어떤 기운이 다시 켜지는지가 실제 체감의 차이를 만듭니다. ${yearElementLine}.`;
}

function buildYearlyStrengthReading(report: SajuReportData) {
  const monthParsed = parsePillar(report.pillars.month);
  const hourParsed = parsePillar(report.pillars.hour);
  const missingWood = report.fiveElements.some((item) => item.label === '목' && item.value === 0);
  const hourSupportsFireEarth = Boolean(
    hourParsed && [hourParsed.stemElement, hourParsed.branchElement].some((element) => element === '화' || element === '토')
  );
  const supportSource = hourSupportsFireEarth ? '시주와 원국 안의 화·토' : '원국 안의 화·토';

  if (report.dayMasterElement === '토' && monthParsed?.branchElement === '금') {
    return `${report.dayMaster} 일간은 ${report.pillars.month} 월령상 식상 금 기운이 강해 일간의 힘이 밖으로 빠져나갑니다.${missingWood ? ' 목이 비어 균형 감각도 흔들리기 쉽습니다.' : ''} 다만 ${supportSource}가 일간을 보완하므로 무조건 신약으로 단정하지 않습니다. ${report.strengthLabel} 판정은 약신약 또는 중화 쪽까지 열어두고, 실제 판단은 체력, 책임, 결과물의 지속력으로 봅니다.`;
  }

  return `${report.strengthLabel} 판정은 숫자처럼 딱 잘라 끝낼 문제가 아닙니다. 월령이 일간을 밀어주는지, 지지에 뿌리가 있는지, 대운에서 보완 기운이 들어오는지를 함께 봐야 합니다. 그래서 올해는 강하다/약하다보다 어떤 상황에서 체력과 책임이 먼저 흔들리는지를 보는 편이 정확합니다.`;
}

const REPORT_PILLAR_NAMES = {
  year: '년지',
  month: '월지',
  day: '일지',
  hour: '시지'
} as const;

function getReportBranchPieces(report: SajuReportData) {
  return PILLAR_LABELS.map((pillar) => {
    const parsed = parsePillar(report.pillars[pillar.key]);
    return parsed
      ? {
          key: pillar.key,
          label: REPORT_PILLAR_NAMES[pillar.key],
          stem: parsed.stem,
          branch: parsed.branch,
          branchHanja: parsed.branchHanja,
          branchElement: parsed.branchElement
        }
      : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function findBranchPiece(report: SajuReportData, branch: string) {
  return getReportBranchPieces(report).find((piece) => piece.branch === branch);
}

function hasReportBranches(report: SajuReportData, branches: string[]) {
  const present = new Set(getReportBranchPieces(report).map((piece) => piece.branch));
  return branches.every((branch) => present.has(branch));
}

function formatBranchLocation(piece?: ReturnType<typeof getReportBranchPieces>[number]) {
  return piece ? `${piece.label} ${piece.branchHanja}` : '해당 지지';
}

function buildSignatureStrengthLine(report: SajuReportData) {
  const month = parsePillar(report.pillars.month);
  const hasFireRoot = getReportBranchPieces(report).some((piece) => piece.branchElement === '화') || /병|정/.test(Object.values(report.pillars).join(''));
  const hasEarthRoot = getReportBranchPieces(report).some((piece) => piece.branchElement === '토') || /무|기/.test(Object.values(report.pillars).join(''));

  if (report.dayMasterElement === '토' && month?.branchElement === '금') {
    return `${report.dayMaster}토 일간이 ${report.pillars.month} 월령을 만나면 식상 금기가 강해져 힘이 밖으로 빠집니다. 그런데 ${hasFireRoot ? '丁·巳 같은 화의 온도' : '화의 보완'}와 ${hasEarthRoot ? '戊·己·토의 뿌리' : '토의 뿌리'}가 같이 있어 완전 신약으로 자르면 거칠어집니다. 정확히는 중화에서 약신약 사이, 차가운 금수 환경에서는 체감상 신약처럼 반응하는 구조입니다.`;
  }

  return `${report.strengthLabel} 판정은 한 단어로 끝내면 얕아집니다. 월령이 일간을 밀어주는지, 지지에 뿌리가 있는지, 대운에서 어떤 기운이 다시 켜지는지를 함께 봐야 실제 체감이 맞습니다.`;
}

function buildSignatureRelationReadings(report: SajuReportData): ReportSection {
  const cards: NonNullable<ReportSection['cards']> = [];
  const details: NonNullable<ReportSection['details']> = [];
  const ja = findBranchPiece(report, '자');
  const yu = findBranchPiece(report, '유');
  const sa = findBranchPiece(report, '사');
  const sin = findBranchPiece(report, '신');

  if (hasReportBranches(report, ['자', '유'])) {
    cards.push({
      title: '子酉破 · 가까워진 뒤 거리두기',
      body: `${formatBranchLocation(ja)}와 ${formatBranchLocation(yu)}의 子酉破는 단순한 관계 불화가 아닙니다. 처음엔 맞춰주다가도 약속, 말투, 답장 온도가 어긋나면 마음속에서 먼저 선을 긋는 패턴으로 나옵니다.`,
      tone: 'warn'
    });
    details.push({
      summary: '子酉破가 실제 생활에서 터지는 장면',
      content: `겉으로는 “괜찮아”라고 말하지만 속으로는 이미 관계 평가가 끝난 상태가 반복될 수 있습니다.\n\n상대가 계속 작은 부탁을 하거나, 답장을 당연하게 기다리거나, 돈과 시간을 흐리면 어느 순간 답장이 짧아지고 연락을 피하게 됩니다.\n\n이 파는 사람을 오래 못 믿는다는 단정이 아니라, 가까워질수록 세부 태도를 날카롭게 보는 구조입니다.`,
      open: true
    });
  }

  if (hasReportBranches(report, ['사', '신'])) {
    cards.push({
      title: '巳申合刑 · 생각 과부하',
      body: `${formatBranchLocation(sa)}와 ${formatBranchLocation(sin)}이 만나면 합처럼 끌리면서도 형처럼 피로가 생깁니다. 일은 멈췄는데 머리는 계속 돌아가고, 밤에 계획·걱정·계산이 한꺼번에 떠오르기 쉽습니다.`,
      tone: 'warn'
    });
    details.push({
      summary: '巳申 합형이 만드는 일·몸·관계 반응',
      content: `좋은 아이디어가 갑자기 많아지고, 사람도 붙고, 할 일도 늘어납니다. 문제는 그 속도만큼 신경계가 쉬지 못한다는 점입니다.\n\n낮에는 담담히 처리하다가 밤에 머리가 계속 돌아가고, 작은 말 하나를 오래 곱씹고, 쉬는 날에도 일의 다음 수를 계산하는 식으로 나타납니다.\n\n이때 필요한 건 더 열심히가 아니라 업무 마감선, 답장 가능 시간, 수면 전 차단 루틴입니다.`,
      open: true
    });
  }

  if (hasReportBranches(report, ['신', '자'])) {
    cards.push({
      title: '申子 반합 · 돈과 이동의 물길',
      body: `${formatBranchLocation(sin)}와 ${formatBranchLocation(ja)}의 반합은 수 기운을 살립니다. 사람, 정보, 돈의 흐름이 열릴 수 있지만 동시에 이동·연락·감정 소모도 같이 커집니다.`,
      tone: 'good'
    });
    details.push({
      summary: '申子 반합을 돈으로 쓰는 법',
      content: `이 흐름은 혼자 조용히 앉아 있는 운이 아니라, 문의·소개·이동·정보가 돈과 연결되는 운입니다.\n\n다만 물길이 열리면 새는 곳도 생깁니다. 상담, 결제, 환불, 수정 요청, 재문의가 한꺼번에 들어올 수 있으니 “들어오는 돈”보다 “남는 돈”을 먼저 봐야 합니다.`,
      open: true
    });
  }

  if (yu) {
    cards.push({
      title: '월지 酉 도화 · 소개와 평판',
      body: `월지 酉 도화는 단순히 매력이 있다는 말로 끝내면 약합니다. 소개, 후기, 평판, 말투, 결과물의 깔끔함이 사람을 끌어오는 통로가 됩니다. 다만 子酉破가 같이 있으면 끌림은 생겨도 유지에는 기준이 필요합니다.`,
      tone: 'good'
    });
    details.push({
      summary: '도화가 강할 때 고객이 체감하는 포인트',
      content: `처음부터 과하게 튀는 매력보다 “깔끔하다, 믿을 만하다, 다시 맡기고 싶다”는 인상으로 도화가 작동합니다.\n\n연애에서도 사람은 붙지만, 상대의 연락 습관과 책임감이 불안정하면 빠르게 정이 떨어질 수 있습니다. 사업에서는 얼굴보다 후기, 샘플, 설명의 결이 매력 포인트가 됩니다.`,
      open: true
    });
  }

  if (cards.length === 0) {
    cards.push({
      title: '관계 구조',
      body: '이 명식은 큰 충돌보다 월령, 대운, 십성의 조합으로 관계 피로가 생기는 쪽입니다. 사람을 넓히기보다 오래 남길 사람을 고르는 기준이 중요합니다.'
    });
  }

  return {
    id: 'signature-relation-events',
    title: '합충형파 실제 사건 해석',
    subtitle: '관계가 좋다/나쁘다가 아니라 어떤 장면에서 피로와 사건이 생기는지 봅니다.',
    cards,
    details
  };
}

function getSignatureMonthScene(item: SajuReportData['monthLuck'][number], report: SajuReportData) {
  const parsed = parsePillar(item.ganzhi);
  const monthLabel = `${item.year}.${String(item.month).padStart(2, '0')}`;
  const branch = parsed?.branch || '';
  const stemElement = parsed?.stemElement || '천간';
  const branchElement = parsed?.branchElement || '지지';
  const dayunName = report.currentDayun.name;
  const base = {
    basis: `${monthLabel} ${item.ganzhi} 월운은 ${dayunName} 대운 위로 천간에는 ${stemElement} 기운, 지지에는 ${branchElement} 기운이 들어오는 달입니다.`,
    event: '선택지가 늘지만 실제로 남는 것은 약속, 돈, 일정이 정리된 일입니다.',
    money: '돈은 들어오는 흐름보다 빠져나가는 구멍을 먼저 확인해야 합니다.',
    relation: '사람의 말보다 반복 행동과 약속 이행을 보세요.',
    body: '수면과 소화, 목·어깨 피로가 먼저 신호를 줄 수 있습니다.',
    action: '새로 벌리기보다 하나를 끝까지 마무리하세요.'
  };

  const byBranch: Record<string, Partial<typeof base>> = {
    자: {
      event: '子수가 들어오면 돈, 연락, 감정이 동시에 흔들립니다. 밤에 생각이 많아지고 답장을 미루거나 갑자기 거리를 두는 장면이 생기기 쉽습니다.',
      money: '소액 결제, 즉흥 구매, 사람 때문에 쓰는 돈을 조심하세요.',
      relation: '가까운 사람일수록 말투 하나가 크게 들립니다. 길게 설명하기보다 짧게 확인하는 편이 안전합니다.',
      body: '야간 활동과 수면 질이 바로 컨디션을 흔듭니다.',
      action: '밤 10시 이후 큰 결제와 관계 결론을 미루세요.'
    },
    축: {
      event: '丑토는 쌓인 문제를 현실로 끌어냅니다. 미뤄둔 정산, 서류, 가족·조직 책임이 다시 올라올 수 있습니다.',
      money: '새 매출보다 고정비와 미수금을 먼저 보세요.',
      relation: '서운함을 감정으로 풀기보다 역할과 범위를 다시 적어야 합니다.',
      body: '몸이 무거워지고 소화가 느려질 수 있습니다.',
      action: '정산일, 마감일, 제공 범위를 다시 고정하세요.'
    },
    인: {
      event: '寅목은 새 방향을 열지만 이 명식에서는 부족한 목을 자극합니다. 배우고 연결하고 제안하는 감각이 살아납니다.',
      money: '새 상품 아이디어는 좋지만 바로 팔기보다 작은 테스트가 먼저입니다.',
      relation: '소개나 협업 제안이 들어오면 상대의 실행 속도를 확인하세요.',
      body: '시작 에너지는 올라오지만 과속하면 피로가 빨리 옵니다.',
      action: '새 기획은 7일짜리 실험으로 쪼개세요.'
    },
    묘: {
      event: '卯목은 관계 방향과 성장 욕구를 건드립니다. 연락을 다시 열거나 배우고 싶은 주제가 생기기 쉽습니다.',
      money: '교육, 콘텐츠, 상담형 상품의 언어를 다듬기 좋습니다.',
      relation: '좋은 사람처럼 보이는지보다 대화가 다음 행동으로 이어지는지 보세요.',
      body: '눈 피로와 신경 예민함이 올라올 수 있습니다.',
      action: '소개문, 프로필, 상품 설명을 새로 쓰세요.'
    },
    진: {
      event: '辰토는 흩어진 것을 모으는 달입니다. 일, 돈, 사람을 한 번에 정리하고 싶어집니다.',
      money: '반복 결제, 재구매, 패키지 구성을 검토하기 좋습니다.',
      relation: '애매한 관계는 자연스럽게 거리가 생길 수 있습니다.',
      body: '속이 답답하거나 몸이 둔해지면 쉬어야 합니다.',
      action: '남길 일과 버릴 일을 표로 나누세요.'
    },
    사: {
      event: '巳화가 들어오면 원국의 巳申 합형이 다시 켜질 수 있습니다. 머리가 빨라지고 공개·홍보 욕구가 올라오지만 생각 과부하도 같이 옵니다.',
      money: '새 고객보다 기존 문의를 상품으로 전환하는 데 집중하세요.',
      relation: '좋은 말만 믿지 말고 실제 일정과 입금 여부를 확인해야 합니다.',
      body: '불면, 열감, 목·어깨 긴장이 올라올 수 있습니다.',
      action: '공개 전 체크리스트를 만들고 밤에는 일을 닫으세요.'
    },
    오: {
      event: '午화는 드러남과 표현을 키웁니다. 콘텐츠, 소개, 홍보, 발표에 힘이 실립니다.',
      money: '가격을 숨기지 말고 보여주는 쪽이 낫습니다.',
      relation: '호감 표현은 늦추지 말되 과한 약속은 피하세요.',
      body: '체력은 올라오지만 과열되면 짜증이 늘 수 있습니다.',
      action: '대표 결과물 하나를 밖으로 꺼내세요.'
    },
    미: {
      event: '未토는 벌린 일을 고정합니다. 새 시작보다 이미 가진 것을 다듬어 자리 잡게 하는 달입니다.',
      money: '고정 상품, 정기 결제, 재구매 구조를 만들기 좋습니다.',
      relation: '가까운 사람과 책임 문제가 올라올 수 있습니다.',
      body: '소화와 수면 리듬을 안정시키는 것이 먼저입니다.',
      action: '가격표와 제공 범위를 확정하세요.'
    },
    신: {
      event: '申금은 원국의 巳申 합형과 申子 반합을 동시에 건드립니다. 문의, 이동, 정보, 돈 흐름이 늘지만 머리가 쉬지 않을 수 있습니다.',
      money: '고객은 늘 수 있지만 수정 요청과 응대 시간이 같이 늘어납니다.',
      relation: '말 많은 사람보다 실제 결제와 약속을 지키는 사람을 보세요.',
      body: '신경 과부하와 눈·어깨 피로를 조심하세요.',
      action: '응대 시간과 수정 횟수를 먼저 제한하세요.'
    },
    유: {
      event: '酉금은 월지 酉 도화를 다시 건드립니다. 소개, 평판, 후기, 이미지가 강해지는 달입니다.',
      money: '후기와 샘플이 돈으로 바뀌기 쉽습니다.',
      relation: '子酉破가 같이 작동하면 끌림은 생겨도 유지에서 피로가 올 수 있습니다.',
      body: '예민함이 올라와 사소한 말투가 크게 들릴 수 있습니다.',
      action: '후기 정리와 관계 경계선을 같이 잡으세요.'
    },
    술: {
      event: '戌토는 화고를 품어 기존 결과물을 다시 데우는 달입니다. 새 고객보다 기존 신뢰 관계에서 큰 제안이나 재구매가 생기기 쉽습니다.',
      money: '묵혀둔 상품, 지난 고객, 예전 문의를 다시 꺼내면 성과가 붙을 수 있습니다.',
      relation: '오래 본 사람과 조건을 다시 맞추기 좋습니다.',
      body: '과로하면 건조함과 긴장이 올라옵니다.',
      action: '기존 결과물을 재정리해 다시 공개하세요.'
    },
    해: {
      event: '亥수는 감정과 돈의 물길을 크게 엽니다. 사람 이야기를 들어주다 내 리듬이 흔들릴 수 있습니다.',
      money: '상담·문의는 늘 수 있지만 무료 응대가 길어지면 손해입니다.',
      relation: '연민으로 시작한 관계가 책임으로 바뀌지 않게 조심하세요.',
      body: '수면, 부종, 무기력 신호를 가볍게 넘기지 마세요.',
      action: '무료 상담 범위와 답변 시간을 정하세요.'
    }
  };

  return { ...base, ...(byBranch[branch] || {}) };
}

function buildSignatureMonthContent(item: SajuReportData['monthLuck'][number], report: SajuReportData) {
  const scene = getSignatureMonthScene(item, report);

  return [
    `명리 근거: ${scene.basis}`,
    `사건성: ${scene.event}`,
    `돈: ${scene.money}`,
    `관계: ${scene.relation}`,
    `몸 상태: ${scene.body}`,
    `행동 기준: ${scene.action}`
  ].join('\n\n');
}

function getSignatureMonthSummary(item: SajuReportData['monthLuck'][number], report: SajuReportData) {
  const scene = getSignatureMonthScene(item, report);
  return `${item.year}.${String(item.month).padStart(2, '0')} · ${getLuckPhase(item.score)} · ${scene.action.replace(/하세요\.?$/, '')}`;
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

function describeTenGodDepth(label: string) {
  if (label.includes('비견')) {
    return `${label}은 혼자 기준을 세우는 힘입니다. 애매한 지시 아래에서는 오히려 스트레스가 커지고, “그냥 알아서 해줘”라는 말보다 역할과 권한이 분명할 때 실력이 살아납니다. 피곤하면 도움을 청하기보다 혼자 끝내려 해서 표정이 굳고 답장이 짧아질 수 있습니다.`;
  }
  if (label.includes('겁재')) {
    return `${label}은 경쟁자와 같은 판에 섰을 때 켜지는 힘입니다. 누가 내 몫을 흐리거나 공을 가져가려 하면 겉으론 참아도 속으로는 바로 선을 긋습니다. 잘 쓰면 독립성과 돌파력이 되지만, 감정이 앞서면 관계를 한 번에 끊는 식으로 나올 수 있습니다.`;
  }
  if (label.includes('식') || label.includes('상')) {
    if (label.includes('식')) {
      return `${label}은 말을 길게 늘리는 힘이 아니라 “이렇게 하면 됩니다”라고 정리해주는 힘입니다. 복잡한 문제를 순서, 예시, 결과물로 바꿀 때 신뢰가 붙습니다. 다만 피곤하면 설명을 포기하고 “알아서 판단해”처럼 차갑게 끊길 수 있어, 핵심 문장 하나를 남기는 습관이 중요합니다.`;
    }

    return `${label}은 답답한 구조를 그냥 넘기지 못하는 표현력입니다. 틀린 말, 비효율, 억지 규칙을 보면 속으로 바로 반박이 올라옵니다. 잘 쓰면 기획과 브랜딩의 칼이 되고, 거칠게 쓰면 말투가 세다는 인상을 남기니 공개 문장은 한 번 식혀서 내보내야 합니다.`;
  }
  if (label.includes('편재')) {
    return `${label}는 사람과 돈의 흐름을 빠르게 읽는 감각입니다. 분위기가 뜨면 기회도 빨리 잡지만, 그만큼 식사비, 이동비, 즉흥 결제도 같이 커질 수 있습니다. 돈은 들어오는데 쉬는 시간이 사라지는 장면을 조심해야 합니다.`;
  }
  if (label.includes('정재')) {
    return `${label}는 한 번 들어온 돈을 새지 않게 붙잡는 힘입니다. 정산일, 고정비, 반복 결제, 환불 기준처럼 작은 숫자를 챙길 때 강합니다. 다만 돈 이야기를 미루면 마음은 불편한데 입은 늦어져 손해를 떠안을 수 있습니다.`;
  }
  if (label.includes('편관')) {
    return `${label}은 압박이 걸릴 때 집중력이 살아나는 힘입니다. 마감, 경쟁, 책임이 있으면 갑자기 눈빛이 달라집니다. 하지만 늘 전투 모드로 살면 몸이 먼저 굳고, 가까운 사람에게 말투가 날카롭게 나갈 수 있습니다.`;
  }
  if (label.includes('정관')) {
    return `${label}은 약속과 평판을 지키려는 힘입니다. 해야 할 일을 미루지 않는 대신, 책임이 애매한 자리에서는 남의 몫까지 떠안기 쉽습니다. 좋은 사람으로 보이려다 지치지 않으려면 처음부터 역할을 정확히 나눠야 합니다.`;
  }
  if (label.includes('편인')) {
    return `${label}은 혼자 파고들어 답을 찾는 힘입니다. 남들이 대충 넘긴 자료를 붙잡고 밤에 계속 생각하는 식으로 작동합니다. 잘 쓰면 전문성이 되지만, 과하면 의심과 생각 과부하로 잠이 늦어집니다.`;
  }
  if (label.includes('정인')) {
    return `${label}은 보호받고 확인받아야 마음이 놓이는 힘입니다. 공부, 자격, 검증, 안전한 울타리에서 안정됩니다. 다만 완벽히 준비될 때까지 미루면 좋은 타이밍을 놓칠 수 있어 작은 공개가 필요합니다.`;
  }
  return `${label}은 이 명식에서 자주 켜지는 생활 반응입니다. 점수보다 중요한 건 어떤 순간에 말투가 바뀌고, 언제 돈을 쓰고, 어느 관계에서 마음이 먼저 닫히는지입니다.`;
}

function formatCautionElements(report: SajuReportData) {
  const active = report.cautiousElements.filter((element) => (report.fiveElements.find((item) => item.label === element)?.value || 0) > 0);
  const missing = report.cautiousElements.filter((element) => (report.fiveElements.find((item) => item.label === element)?.value || 0) === 0);

  if (active.length > 0 && missing.length > 0) {
    return `${active.join('·')} 쪽이 켜지면 연락, 돈, 이동이 한꺼번에 몰릴 수 있습니다. ${missing.join('·')} 쪽은 넘쳐서가 아니라 비어 있을 때 다음 단계 제안과 관계 방향이 흐려집니다.`;
  }

  if (missing.length > 0) {
    return `${missing.join('·')} 쪽은 넘침보다 공백이 문제입니다. 관계의 방향, 다음 단계 제안, 성장 동선을 의식적으로 만들어야 합니다.`;
  }

  return `${active.join('·')} 쪽이 강해질 때는 속도, 지출, 감정 반응이 같이 커질 수 있습니다.`;
}

function buildCautionSceneBank(report: SajuReportData) {
  const active = report.cautiousElements.filter((element) => (report.fiveElements.find((item) => item.label === element)?.value || 0) > 0);
  const missing = report.cautiousElements.filter((element) => (report.fiveElements.find((item) => item.label === element)?.value || 0) === 0);
  const activeLabel = active.length ? active.join('·') : '압박이 큰 기운';
  const missingLabel = missing.length ? missing.join('·') : '비어 있는 기운';
  const activeSubject = active.length > 1 ? `${activeLabel} 라인이` : withSubjectParticle(activeLabel);
  const missingSubject = missing.length > 1 ? `${missingLabel} 라인이` : withSubjectParticle(missingLabel);

  return [
    `${activeSubject} 강해지는 구간에는 문의와 일정이 같은 날 몰릴 수 있습니다. ${missingSubject} 비면 다음 단계 제안이 늦어져 좋은 사람을 만나도 관계가 멈춥니다.`,
    `돈은 들어오는데 쉬는 시간이 사라질 수 있습니다. ${activeSubject} 과열되면 답장이 짧아지고, ${missingSubject} 약하면 마음은 있어도 표현이 늦어집니다.`,
    `답장, 정산, 수정 요청이 한 번에 겹치면 집중이 흩어집니다. 이때는 더 친절해지려 하기보다 오늘 처리할 범위를 잘라야 합니다.`,
    `사람은 늘어나는데 관계 피로도 같이 커질 수 있습니다. 좋아하는 마음이 있어도 피곤하면 먼저 설명하기보다 조용히 물러나는 쪽으로 반응합니다.`,
    `밤에 판단하면 약속을 크게 잡거나 결제를 쉽게 열 수 있습니다. 다음 날 아침에도 같은 선택을 하고 싶은지 확인해야 손실이 줄어듭니다.`,
    `${missingSubject} 비어 있을 때는 “좋아한다”는 마음이 행동으로 늦게 나옵니다. 그래서 상대는 기다리다 지치고, 본인은 뒤늦게 아쉬워하는 장면이 생길 수 있습니다.`
  ];
}

function buildTenGodSceneDetail(label: string, report: SajuReportData) {
  const core = describeTenGodDepth(label);

  return `${core}\n\n생활 장면: 좋은 자리에서는 말이 많아지기보다 정리가 빨라집니다. “이건 여기까지, 이건 다음에”처럼 선을 그을 때 사람들이 ${report.customerName}님을 믿고 맡깁니다.\n\n감정 흐름: 좋아도 바로 표현하지 않고 먼저 관찰합니다. 마음이 식으면 다시 설득해도 회복이 오래 걸리지 않습니다. 겉으로는 차분해 보여도 속으로는 이미 결론을 내려놓는 편입니다.`;
}

function buildEmotionalFlowSection(report: SajuReportData): ReportSection {
  return {
    id: 'emotional-flow',
    title: '감정 흐름 정밀 해석',
    subtitle: '성격 설명이 아니라 마음이 움직이고 식고 닫히는 실제 순서를 봅니다.',
    cards: [
      {
        title: '좋아해도 표현이 늦다',
        body: `${report.customerName}님은 마음이 커질수록 더 조심스러워질 수 있습니다. 먼저 확신을 얻고 싶어서 표현을 아끼는데, 상대는 그 침묵을 관심 부족으로 읽을 수 있습니다.`,
        tone: 'warn'
      },
      {
        title: '식으면 회복이 빠르지 않다',
        body: '한 번 마음이 식으면 감정이 다시 뜨겁게 돌아오기보다, 왜 식었는지를 차분히 확인하는 쪽으로 갑니다. 사과 한마디보다 이후 태도가 바뀌는지를 봅니다.'
      },
      {
        title: '속으로 먼저 정리한다',
        body: '겉으로는 큰소리 내지 않아도 마음속에서는 이미 관계를 정리해둔 뒤일 수 있습니다. 그래서 마지막 대화가 싸움이 아니라 아주 짧은 답장으로 끝나는 경우가 생깁니다.'
      },
      {
        title: '피곤하면 말투가 차가워진다',
        body: '컨디션이 떨어지면 감정을 설명할 힘이 줄어듭니다. 이때는 싫어서가 아니라 더 망치기 싫어서 답장을 미루고, 거리를 두고, 혼자 생각합니다.',
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '관계에서 제일 자주 반복되는 감정 순서',
        content: `처음에는 상대의 장점과 가능성을 크게 봅니다.\n\n그다음 작은 약속, 말투, 돈 쓰는 방식, 답장 온도를 봅니다.\n\n여기서 어긋남이 반복되면 바로 화를 내기보다 속으로 거리를 둡니다.\n\n마지막에는 긴 설명보다 짧은 답장, 늦은 답장, 만남 회피로 마음이 빠져나옵니다.`,
        open: true
      }
    ]
  };
}

function polishRepeatedReportLanguage(report: SajuReportData, repeatedCaution: string, cautionScenes: string[]) {
  let cautionIndex = 0;
  let behaviorIndex = 0;
  const behaviorAlternatives = ['지난 행동', '평소 태도', '약속을 지키는 방식', '돈과 시간의 쓰임', '갈등 뒤 돌아오는 말투'];
  const behaviorForms = [
    {
      source: '반복 행동을',
      alternatives: ['지난 행동을', '평소 태도를', '약속을 지키는 방식을', '돈과 시간의 쓰임을', '갈등 뒤 돌아오는 말투를']
    },
    {
      source: '반복 행동이',
      alternatives: ['지난 행동이', '평소 태도가', '약속을 지키는 방식이', '돈과 시간의 쓰임이', '갈등 뒤 돌아오는 말투가']
    },
    {
      source: '반복 행동은',
      alternatives: ['지난 행동은', '평소 태도는', '약속을 지키는 방식은', '돈과 시간의 쓰임은', '갈등 뒤 돌아오는 말투는']
    },
    {
      source: '반복 행동과',
      alternatives: ['지난 행동과', '평소 태도와', '약속을 지키는 방식과', '돈과 시간의 쓰임과', '갈등 뒤 돌아오는 말투와']
    }
  ];

  const replaceText = (text: string) => {
    let next = text;

    while (repeatedCaution && next.includes(repeatedCaution)) {
      next = next.replace(repeatedCaution, cautionScenes[cautionIndex % cautionScenes.length]);
      cautionIndex += 1;
    }

    for (const form of behaviorForms) {
      while (next.includes(form.source)) {
        next = next.replace(form.source, form.alternatives[behaviorIndex % form.alternatives.length]);
        behaviorIndex += 1;
      }
    }

    while (next.includes('반복 행동')) {
      next = next.replace('반복 행동', behaviorAlternatives[behaviorIndex % behaviorAlternatives.length]);
      behaviorIndex += 1;
    }

    return next
      .replace(/무엇을 쓰는 선택인지 먼저 확인하세요/g, '어느 칸이 먼저 무너지는지 보세요')
      .replace(/상황에 따라 장점과 부담이 함께 드러날 수 있는 성향 축입니다\./g, '생활 속에서 말투, 돈, 약속 방식으로 바로 드러나는 축입니다.');
  };

  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return replaceText(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => walk(item));
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, walk(item)])
      );
    }

    return value;
  };

  return walk(report) as SajuReportData;
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

function getConcernEvidenceItems(report: SajuReportData, index: number) {
  const topTenGods = report.tenGods
    .slice(0, 2)
    .map((item) => item.label)
    .join('·');
  const helpfulText = formatElementList(report.helpfulElements) || '균형 오행';
  const questionOrder = index === 0 ? '첫 번째 질문' : '두 번째 질문';

  return [
    `${questionOrder}은 일간 ${report.dayMaster}과 ${report.strengthLabel} 흐름을 기준으로 봅니다. 감정 하나보다 돈, 시간, 관계, 체력 조건을 나눠 볼 때 답이 선명해집니다.`,
    `현재 ${report.currentDayun.name} 대운에서는 고민이 실제 책임 범위와 선택 순서 문제로 올라오기 쉽습니다. ${asSentence(report.currentDayun.focus)}`,
    topTenGods
      ? `십성에서는 ${topTenGods} 흐름이 앞에 있습니다. 말보다 반복 행동, 기분보다 결과물, 호감보다 약속 이행에서 진짜 답이 드러납니다.`
      : `${withTopicParticle(`${helpfulText} 기운`)} 지금 고민을 현실로 정리하는 기준입니다. 생활 리듬과 기록이 잡히면 판단이 안정됩니다.`
  ];
}

function getConcernTopicLabel(question: string) {
  if (isSelfHarmQuestion(question)) {
    return '안전·위기';
  }

  if (hasConcernKeyword(question, ['뭐하고', '직업', '일', '사업', '진로', '돈벌', '먹고', '살까'])) {
    return '일·진로';
  }

  if (hasConcernKeyword(question, ['결혼', '혼인', '배우자', '시집', '장가'])) {
    return '결혼·생활 안정';
  }

  if (hasConcernKeyword(question, ['연애', '인연', '상대', '썸', '재회', '사랑'])) {
    return '연애·관계';
  }

  if (hasConcernKeyword(question, ['돈', '재물', '투자', '수입', '매출', '가격'])) {
    return '돈·현실 조건';
  }

  if (hasConcernKeyword(question, ['언제', '시기', '올해', '내년', '타이밍', '기회'])) {
    return '시기·선택 타이밍';
  }

  return '복합 고민';
}

function getConcernTopicProfile(question: string, report: SajuReportData) {
  const helpfulText = formatElementList(report.helpfulElements) || '균형 오행';
  const topic = getConcernTopicLabel(question);

  if (topic === '안전·위기') {
    return {
      root:
        '이 고민은 사주 풀이보다 안전 확보가 먼저인 신호입니다. 마음이 약해서가 아니라, 피로와 압박이 한꺼번에 몰려 혼자 버티는 시간이 위험해진 상태로 봐야 합니다.',
      sajuLink: `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 함께 보면 책임, 돈, 관계, 생활 리듬이 동시에 흔들릴 때 세상과 끊기고 싶은 감각이 올라올 수 있습니다. 하지만 이 해석은 원인을 설명하는 보조 자료일 뿐, 지금의 우선순위는 곧바로 사람과 기관에 연결되는 것입니다.`,
      resolution:
        '혼자 있지 말고 가까운 사람에게 지금 상태를 알리세요. 한국에서는 자살예방 상담전화 109, 긴급 상황은 119 또는 112로 바로 연락하는 것이 먼저입니다.'
    };
  }

  if (topic === '일·진로') {
    return {
      root:
        '이 고민은 “무슨 직업을 고를까”보다 “내 기준과 설명 능력을 어디에 팔아야 덜 지치고 오래 갈까”에 가깝습니다. 남이 정한 틀을 오래 견디는 방식보다, 정보를 정리하고 사람의 막힌 지점을 풀어주는 역할에서 체감이 살아납니다.',
      sajuLink: `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 함께 보면, 일의 이름보다 결과물·가격표·상담 흐름처럼 눈에 보이는 구조가 중요합니다. ${withObjectParticle(`${helpfulText} 기운`)} 보완할수록 흩어진 생각이 상품과 업무 순서로 내려옵니다.`,
      resolution:
        '상담형 콘텐츠, 분석형 서비스, 지식판매, 예약형 리포트, 데이터 정리형 기획처럼 “내가 판단한 기준을 고객이 이해할 수 있게 바꾸는 일”부터 작게 테스트하는 편이 좋습니다.'
    };
  }

  if (topic === '결혼·생활 안정') {
    return {
      root:
        '이 고민은 결혼 여부 하나보다 생활을 같이 굴릴 수 있는 사람인지 확인하려는 마음에서 커집니다. 설렘이 있어도 돈, 가족 거리, 시간 약속, 갈등 후 회복 방식이 흔들리면 마음이 빨리 피로해질 수 있습니다.',
      sajuLink: `${report.dayMaster} 일간은 관계에서도 안정 기준이 있어야 마음이 놓입니다. ${report.currentDayun.name} 대운에서는 사람과 현실 조건이 함께 움직이므로, 호감보다 생활 규칙과 책임 분담을 먼저 봐야 합니다.`,
      resolution:
        '상대의 말투보다 반복 행동을 보세요. 약속을 지키는 속도, 돈 이야기를 피하지 않는 태도, 바쁜 날의 배려, 다툰 뒤 다시 맞추는 방식이 결혼 안정성을 판단하는 핵심 자료가 됩니다.'
    };
  }

  if (topic === '연애·관계') {
    return {
      root:
        '이 고민은 상대 마음을 맞히는 문제보다, 내가 어떤 관계에서 불안해지고 어떤 관계에서 편안해지는지 구분하는 문제에 가깝습니다. 답장을 기다리며 혼자 결론을 만들거나, 상대의 작은 변화에 오래 신경 쓰는 장면이 반복될 수 있습니다.',
      sajuLink: `${report.dayMaster} 일간과 ${report.strengthLabel} 흐름에서는 감정을 빨리 터뜨리기보다 안에서 오래 정리하는 경향이 나타날 수 있습니다. 그래서 관계운은 끌림의 강도보다 연락 리듬, 약속 이행, 갈등 후 회복 방식을 함께 봅니다.`,
      resolution:
        '상대에게 긴 설명을 보내기보다 “언제 볼 수 있는지”, “어떤 방식이 편한지”, “내가 가능한 범위가 어디까지인지”를 짧게 확인하는 쪽이 관계의 무게를 줄입니다.'
    };
  }

  if (topic === '돈·현실 조건') {
    return {
      root:
        '이 고민은 돈이 있느냐 없느냐보다 돈이 들어온 뒤 어디서 새는지를 보려는 질문입니다. 사람 정, 급한 마음, 체면, 불안한 확장 때문에 지출이 생기면 수익보다 피로가 먼저 남을 수 있습니다.',
      sajuLink: `${report.currentDayun.name} 대운에서는 돈과 선택지가 실제 문제로 올라오기 쉽습니다. ${asSentence(report.currentDayun.focus)} 가격, 정산일, 환불 기준, 제공 범위가 분명해야 운이 실제 결과로 남습니다.`,
      resolution:
        '투자 판단보다 현금 방어와 기록이 먼저입니다. 지출을 감정 소비, 관계 지출, 일 지출로 나누고, 반복 구매나 다시보기처럼 이어지는 수익 구조를 작게 만들어보는 편이 안정적입니다.'
    };
  }

  if (topic === '시기·선택 타이밍') {
    return {
      root:
        '이 고민은 “언제 해야 하나”보다 지금 움직이면 어떤 부담이 따라오는지 알고 싶은 마음에서 나옵니다. 좋은 흐름이어도 준비 없이 열면 일정과 체력이 먼저 흔들릴 수 있습니다.',
      sajuLink: `${report.currentDayun.name} 대운 안에서는 같은 선택도 세운과 월운에 따라 체감이 달라집니다. 강한 구간에는 공개와 테스트, 약한 구간에는 정리와 회복처럼 역할을 나누는 편이 좋습니다.`,
      resolution:
        '날짜 하나를 맞히기보다 실행기, 조율기, 회복기를 나눠 잡으세요. 시작 전에는 비용, 사람, 일정, 체력을 적어보고 빠진 조건이 있으면 속도를 낮추는 방식이 안전합니다.'
    };
  }

  return {
    root:
      '이 고민은 한 가지 감정으로 정리하기보다 여러 조건이 동시에 걸린 복합 질문입니다. 마음은 이미 답을 재촉하지만, 실제로는 돈, 관계, 일정, 체력 중 어디가 막혔는지 나눠 봐야 풀립니다.',
    sajuLink: `${report.dayMaster} 일간, ${report.strengthLabel}, ${report.currentDayun.name} 대운을 함께 보면 감정의 크기보다 유지 가능한 조건이 더 중요하게 들어옵니다. ${withObjectParticle(`${helpfulText} 기운`)} 생활에서 보완할수록 판단이 차분해집니다.`,
    resolution:
      '오늘은 답을 하나로 정하기보다 선택을 네 칸으로 나누세요. 지금 선택이 내 시간, 돈, 사람, 체력 중 무엇을 쓰게 만드는지 적으면 고민의 무게가 줄어듭니다.'
  };
}

function buildConcernFusionReading(report: SajuReportData) {
  const questions = report.questionAnswers.slice(0, 2);
  const topics = questions.map((qa) => getConcernTopicLabel(qa.question));
  const topicText = topics.length ? Array.from(new Set(topics)).join(' + ') : '현재 고민';
  const topicLine = topics.map((topic, index) => `${index + 1}번 ${topic}`).join(', ');
  const profiles = questions.map((qa) => getConcernTopicProfile(qa.question, report));
  const topTenGods = report.tenGods
    .slice(0, 2)
    .map((item) => item.label)
    .join('·');
  const helpfulText = formatElementList(report.helpfulElements) || '균형 오행';
  const cautionText = buildConcernCautionSentence(report.cautiousElements);
  const currentYear = report.yearLuck[0];

  return {
    title: `${topicText}이 한 사주 안에서 만나는 지점`,
    summary: `입력한 두 가지 고민은 따로 떨어진 질문처럼 보여도, ${report.customerName}님의 명식에서는 ${report.dayMaster} 일간, ${report.strengthLabel}, ${report.currentDayun.name} 대운이 함께 건드리는 하나의 선택 문제로 읽을 수 있습니다. ${topicLine ? `이번 질문은 ${topicLine} 흐름으로 묶어 봅니다. ` : ''}그래서 이 리포트는 사주 항목을 나열하기보다 “왜 이 고민이 지금 커졌는지, 어디서 손실이 생기는지, 어떤 기준을 세우면 마음이 정리되는지”를 중심으로 풉니다.`,
    cards: [
      {
        title: '두 질문이 만나는 이유',
        body:
          profiles.length > 1
            ? `첫 번째 고민은 ${profiles[0].root} 두 번째 고민은 ${profiles[1].root} 두 질문의 공통점은 감정보다 유지 조건을 먼저 확인해야 마음이 가벼워진다는 점입니다.`
            : profiles[0]?.root || '현재 고민은 감정, 돈, 관계, 체력 조건을 함께 나눠 볼 때 답이 선명해집니다.'
      },
      {
        title: '고민의 뿌리',
        body: topTenGods
          ? `${topTenGods} 흐름이 앞에 있어 생각, 말, 책임, 돈의 조건이 한꺼번에 묶일 때 고민이 커지기 쉽습니다. 이때 성급한 결론보다 조건을 분리하는 과정이 필요합니다.`
          : `${withTopicParticle(`${helpfulText} 기운`)} 고민을 현실 언어로 정리하는 기준입니다. 마음이 복잡할수록 일정, 비용, 관계 책임을 나눠 보는 편이 도움이 됩니다.`
      },
      {
        title: '지금 커진 이유',
        body: `${report.currentDayun.name} 대운은 고민을 마음속 생각으로만 두지 않고 실제 선택, 돈, 관계, 생활 리듬 문제로 끌어올립니다. ${asSentence(report.currentDayun.focus)}`
      },
      {
        title: '해결 방향',
        body: `${withObjectParticle(`${helpfulText} 기운`)} 생활에서 보완하면서, ${cautionText || '과해지는 기운은 기록과 일정으로 속도를 조절하는 편이 좋습니다.'} ${currentYear ? `${currentYear.year}년에는 ${asSentence(currentYear.focus)}` : ''}`
      }
    ]
  };
}

function getConcernResolutionItems(report: SajuReportData, qa: SajuReportData['questionAnswers'][number], index: number) {
  const topic = getConcernTopicLabel(qa.question);
  const questionOrder = index === 0 ? '첫 번째 고민' : '두 번째 고민';
  const profile = getConcernTopicProfile(qa.question, report);

  return [
    {
      title: '고민이 생기는 자리',
      body: `${questionOrder}은 ${topic}으로 읽힙니다. ${profile.root}`
    },
    {
      title: '사주와 연결되는 지점',
      body: profile.sajuLink
    },
    {
      title: '풀리는 방식',
      body: profile.resolution
    }
  ];
}

function getConcernTodayActions(report: SajuReportData) {
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];

  return [
    '지금 고민을 돈, 관계, 일, 체력 중 하나로 먼저 분류하기',
    '카톡이나 통화로 결론내지 말고 메모앱에 조건 3개 적기',
    watchMonth
      ? `${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} ${getLuckPhase(watchMonth.score)}에는 새 확장보다 정리와 회복을 우선하기`
      : '이번 달에는 새 확장보다 정리와 회복을 우선하기'
  ];
}

function ConcernQuestionAnswerCard({
  qa,
  index,
  report,
  variant = 'detail'
}: {
  qa: SajuReportData['questionAnswers'][number];
  index: number;
  report: SajuReportData;
  variant?: 'spotlight' | 'detail';
}) {
  const evidenceItems = getConcernEvidenceItems(report, index);
  const resolutionItems = getConcernResolutionItems(report, qa, index);

  return (
    <div className={`premium-qa-block concern-answer-block ${variant === 'spotlight' ? 'spotlight' : ''}`}>
      <div className="premium-card premium-question-card concern-question-card">
        <span className="concern-answer-label">질문 {index + 1}</span>
        <h3>Q. {qa.question}</h3>
      </div>

      <div className="premium-card premium-answer-card concern-answer-card">
        <span className="concern-answer-label">결론 먼저</span>
        <h3>{qa.title}</h3>
        <p>{qa.analysis}</p>

        <div className="concern-resolution-grid">
          {resolutionItems.map((item) => (
            <article key={item.title} className="concern-resolution-card">
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </article>
          ))}
        </div>

        <div className="concern-evidence-panel">
          <strong>명리 근거</strong>
          <ul className="premium-list">
            {evidenceItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="concern-action-panel">
          <strong>실행 조언</strong>
          <ul className="premium-list">
            {qa.advice.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ConcernAnswerSpotlight({ report }: { report: SajuReportData }) {
  if (report.serviceId !== 'concern-reading' || !report.questionAnswers.length) {
    return null;
  }

  const todayActions = getConcernTodayActions(report);
  const fusionReading = buildConcernFusionReading(report);

  return (
    <section className="premium-report-section concern-answer-priority" id="answer-first">
      <div className="premium-section-heading">
        <div>
          <h2>고민 결론 먼저 보기</h2>
          <p className="premium-muted">결제 직후 가장 먼저 확인할 답과 선택 기준을 위로 정리했습니다.</p>
        </div>
      </div>

      <div className="concern-fusion-panel">
        <span className="concern-answer-label">두 고민 통합 진단</span>
        <h3>{fusionReading.title}</h3>
        <p>{fusionReading.summary}</p>
        <div className="concern-fusion-grid">
          {fusionReading.cards.map((card) => (
            <article key={card.title} className="concern-fusion-card">
              <strong>{card.title}</strong>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
        <small>이 해석은 입력값과 명리 구조를 바탕으로 한 상담형 참고 자료이며, 법률·투자·의료·혼인 시기처럼 삶을 크게 흔드는 사안은 결과를 단언하지 않습니다.</small>
      </div>

      <div className="concern-answer-priority-grid">
        {report.questionAnswers.slice(0, 2).map((qa, index) => (
          <ConcernQuestionAnswerCard
            key={`spotlight-${qa.question}-${index}`}
            qa={qa}
            index={index}
            report={report}
            variant="spotlight"
          />
        ))}
      </div>

      <div className="concern-today-panel">
        <span className="concern-answer-label">오늘 바로 할 일 3개</span>
        <div className="concern-today-grid">
          {todayActions.map((item, index) => (
            <article key={item} className="concern-today-card">
              <strong>{index + 1}</strong>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </div>
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
        `현재 대운인 ${report.currentDayun.name}은 선택지가 돈, 관계, 일의 압력으로 실제화되는 흐름입니다. ${asSentence(report.currentDayun.focus)} 다만 ${asSentence(report.currentDayun.caution)} 이 사주는 기회가 부족한 타입이 아니라, 들어온 흐름을 정리해서 내 몫으로 남기는 힘이 관건입니다.`,
        currentYear
          ? `${currentYear.year}년의 포인트는 "${currentYear.headline}"입니다. 집중해야 할 것은 ${currentYear.focus}이고, 조심해야 할 것은 ${currentYear.warning}입니다. 결론을 빨리 내기보다, 선택 이후 생길 지출, 회의, 마감, 사람 관리까지 감당 가능한지 먼저 계산하는 편이 맞습니다.`
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
        body: `${report.cautiousElements.join(', ')} 흐름이 과열되면 판단이 빨라지고 체력 소모가 커질 수 있습니다. 중요한 선택은 하루 묵힌 뒤 다시 보세요.`,
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

function buildConcernReadingReport(report: SajuReportData): SajuReportData {
  if (report.serviceId !== 'concern-reading') {
    return report;
  }

  const dominantTenGod = report.tenGods[0]?.label || '주요 십성';
  const secondTenGod = report.tenGods[1]?.label || '보조 십성';
  const currentYear = report.yearLuck[0];
  const bestMonth = [...report.monthLuck].sort((left, right) => right.score - left.score)[0];
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];
  const topTenGods = report.tenGods
    .slice(0, 3)
    .map((item) => item.label)
    .join(' · ');
  const elementFlow = report.fiveElements.map((item) => `${item.label} ${item.value}`).join(' / ');
  const bestMonthText = bestMonth ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} ${getLuckPhase(bestMonth.score)}` : '흐름이 열리는 달';
  const watchMonthText = watchMonth ? `${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} ${getLuckPhase(watchMonth.score)}` : '속도를 줄일 달';
  const tenGodRows = report.tenGods.slice(0, 8).map((item) => [
    item.label,
    String(item.value),
    item.value >= 3
      ? '강하게 드러나는 행동 패턴입니다. 장점으로 쓰면 추진력이 되고, 과하면 반복 피로가 됩니다.'
      : item.value === 2
        ? '상황에 따라 안정적으로 작동합니다. 고민의 종류에 따라 장점과 부담이 함께 나옵니다.'
        : '부족하거나 약하게 드러나는 영역입니다. 의식적으로 보완하면 체감 만족도가 커집니다.'
  ]);
  const lifeCycleCards: NonNullable<ReportSection['cards']> = report.yearLuck.slice(0, 5).map((item) => ({
    title: `${item.year}년 · ${getLuckPhase(item.score)}`,
    body: `${item.headline}. ${asSentence(item.focus)} ${asSentence(item.warning)} 이 시기에는 밀어붙이기보다 역할을 나눠 적용하는 편이 좋습니다.`,
    tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
  }));

  const sections: ReportSection[] = [
    {
      id: 'concern-structure',
      title: '1. 사주 기본 구조 분석',
      subtitle: '생년월일시를 천간지지로 바꾸고, 네 기둥이 어느 시기를 뜻하는지 먼저 봅니다.',
      callout: {
        title: '고민풀이의 출발점',
        body: `${report.customerName}님의 고민은 단순한 기분 문제가 아니라 원국, 일간 ${report.dayMaster}, ${report.strengthLabel}, 현재 ${report.currentDayun.name} 대운이 함께 만든 선택 압박으로 읽습니다.`
      },
      table: {
        headers: ['기둥', '계산값', '시기 의미'],
        rows: [
          ['연주', report.pillars.year, '태어난 배경, 초년 환경, 바깥에서 보이는 첫인상'],
          ['월주', report.pillars.month, '사회성, 일의 방식, 부모·조직·생활 기준'],
          ['일주', report.pillars.day, '나 자신, 감정의 중심, 관계에서 반복되는 기준'],
          ['시주', report.pillars.hour || '시간 미상', '후반 흐름, 결과를 만드는 습관, 깊은 욕구']
        ]
      },
      details: [
        {
          summary: '원국을 고민으로 읽는 방법',
          content:
            '원국은 성격표가 아니라 반복되는 선택 습관을 보는 지도입니다. 같은 고민이 계속 돌아온다면 운이 나빠서라기보다 특정 십성, 오행, 관계 구조가 같은 방식으로 작동하고 있을 가능성이 큽니다.',
          open: true
        }
      ]
    },
    {
      id: 'concern-ten-gods',
      title: '2. 십성(十星) 확인',
      subtitle: '비견·겁재, 식신·상관, 정재·편재 등 십성의 개수와 위치로 고민의 성격을 봅니다.',
      callout: {
        title: `핵심 십성: ${topTenGods || dominantTenGod}`,
        body: `${dominantTenGod}과 ${secondTenGod}의 흐름이 고민의 표현 방식을 크게 좌우합니다. 어떤 사람은 혼자 책임지느라 지치고, 어떤 사람은 생각이 너무 많아 결정 직전에 흔들립니다.`
      },
      table: {
        headers: ['십성', '개수', '고민에서 드러나는 방식'],
        rows: tenGodRows
      },
      cards: [
        {
          title: '비겁 흐름',
          body: '강하면 혼자 버티는 압박, 약하면 자기 기준이 흔들리는 문제로 나타납니다.'
        },
        {
          title: '식상 흐름',
          body: '표현, 말, 결과물의 기운입니다. 강하면 생각과 말이 앞서고, 약하면 속마음을 못 꺼내 답답합니다.'
        },
        {
          title: '재성 흐름',
          body: '돈, 현실 감각, 선택지를 다루는 힘입니다. 고민이 돈과 관계 조건으로 번질 때 중요합니다.'
        },
        {
          title: '관성·인성 흐름',
          body: '책임, 눈치, 기준, 보호 본능입니다. 사람 눈치를 많이 보거나 머릿속 시뮬레이션이 많을 때 핵심입니다.'
        }
      ]
    },
    {
      id: 'concern-special',
      title: '3. 특수 요소 분석',
      subtitle: '귀인, 매력살, 합충형해파, 십이신살, 간여지동을 고민의 체감 언어로 바꿉니다.',
      cards: [
        {
          title: '귀인 분석',
          body: '천을, 문창귀인 등은 실제로 도움을 주는 사람, 배움의 통로, 문제를 풀어주는 정보가 어디서 오는지 보는 보조 신호입니다.',
          tone: 'good'
        },
        {
          title: '매력살 분석',
          body: '도화, 홍염, 화개살은 단순 인기보다 관계에서 어떻게 주목받고 어떤 분위기에 끌리는지를 봅니다.'
        },
        {
          title: '합충형해파',
          body: '관계와 일의 흐름이 붙고, 부딪히고, 흔들리는 지점입니다. 고민이 갑자기 커지는 시기를 읽을 때 중요합니다.',
          tone: 'warn'
        },
        {
          title: '십이신살·간여지동',
          body: '이동, 고집, 반복되는 감정 반응, 같은 문제를 다시 겪는 구조를 확인하는 보조 항목입니다.'
        }
      ],
      details: [
        {
          summary: '제공되는 분석 항목',
          content:
            '귀인 분석, 매력살 분석, 합충형해파, 십성 분포, 신강/신약, 대운/세운, 신살 분석, 간여지동, 월간 운세, 종합 정리를 한 리포트 안에서 확인합니다.',
          open: true
        }
      ]
    },
    {
      id: 'concern-period',
      title: '4. 대운·세운 시기 분석',
      subtitle: '현재와 향후 10년 대운, 올해와 내년 세운이 원국과 어떻게 만나는지 봅니다.',
      cards: [
        {
          title: `현재 대운 · ${report.currentDayun.name}`,
          body: `${report.currentDayun.range} 구간은 ${report.currentDayun.focus}이 핵심입니다. ${report.currentDayun.caution}`,
          tone: 'good'
        },
        {
          title: `다음 대운 · ${report.nextDayun.name}`,
          body: `${report.nextDayun.range} 구간은 ${report.nextDayun.summary}`
        },
        {
          title: currentYear ? `${currentYear.year}년 세운` : '올해 세운',
          body: currentYear
            ? `${currentYear.headline}. ${asSentence(currentYear.focus)}`
            : '올해 흐름은 현재 대운과 원국의 충돌 지점을 함께 보아야 정확합니다.'
        },
        {
          title: '월간 운세',
          body: `${bestMonthText}에는 행동을 열고, ${watchMonthText}에는 정리와 회복을 우선하세요.`,
          tone: 'warn'
        }
      ]
    },
    {
      id: 'concern-custom',
      title: '5. 고민별 맞춤 해석',
      subtitle: '연애, 재물, 직업, 인간관계 고민을 각각 다른 명리 기준으로 풉니다.',
      cards: [
        {
          title: '연애운',
          body: '매력살, 관성, 일지 흐름을 함께 보며 왜 끌리고, 왜 연락이 끊기고, 왜 상대에게 흔들리는지 봅니다.'
        },
        {
          title: '재물운',
          body: '재성, 식상, 대운의 현실 압박을 보며 돈 버는 방식과 돈이 새는 구조를 구분합니다.',
          tone: 'good'
        },
        {
          title: '직업운',
          body: '십성, 신살, 월주의 사회성을 보며 직업 이름보다 오래 버티는 일 스타일을 찾습니다.'
        },
        {
          title: '인간관계',
          body: '상사, 동료, 가족, 연인 관계에서 반복되는 기대와 거리감의 원인을 봅니다.',
          tone: 'warn'
        }
      ],
      details: report.questionAnswers.map((qa, index) => ({
        summary: `입력 고민 ${index + 1}: ${qa.question}`,
        content: `${qa.analysis}\n\n실행 조언: ${qa.advice.join(' ')}`,
        open: index === 0
      }))
    },
    {
      id: 'emotion-pattern',
      title: '감정 상태 분석',
      subtitle: '지금 마음이 왜 지치는지, 왜 결정 직전에 흔들리는지 사주 구조로 해석합니다.',
      cards: [
        {
          title: '혼자 버티는 압박',
          body: '비겁 흐름이 강하게 작동하면 책임을 나눠야 할 상황에서도 혼자 감당하려는 습관이 생깁니다.'
        },
        {
          title: '생각 과부하',
          body: '인성 흐름이 과하면 머릿속 시뮬레이션이 많아지고, 시작 전부터 실패 가능성을 먼저 떠올릴 수 있습니다.',
          tone: 'warn'
        },
        {
          title: '표현과 현실의 충돌',
          body: '식상 흐름은 말하고 싶은 것과 실제로 가능한 조건 사이의 간격을 크게 느끼게 합니다.'
        },
        {
          title: '사람 눈치',
          body: '관성 흐름은 책임감으로 쓰면 강점이지만, 과하면 상대 반응을 지나치게 먼저 읽게 만듭니다.'
        }
      ]
    },
    {
      id: 'relationship-pattern',
      title: '인간관계 패턴 분석',
      subtitle: '어떤 사람에게 끌리고, 어떤 관계에서 반복적으로 상처받는지 봅니다.',
      bullets: [
        '처음에는 잘 맞는 것 같지만 시간이 지나며 책임을 혼자 떠안는 관계를 조심해야 합니다.',
        '상대의 말보다 약속, 일정, 돈, 태도가 반복되는지 보는 편이 정확합니다.',
        '도움이 되는 인맥은 감정적으로 뜨거운 사람보다 기준을 지켜주는 사람입니다.',
        '끊어야 할 관계는 내 생활 리듬과 자존감을 계속 흔드는 관계입니다.'
      ]
    },
    {
      id: 'energy-battery',
      title: '사주 에너지 배터리 분석',
      subtitle: '어떤 상황에서 기가 빨리고, 어디서 회복되는지 정리합니다.',
      cards: [
        {
          title: '소모되는 환경',
          body: '성과 압박, 책임 전가, 애매한 약속이 반복되는 환경에서는 에너지 소모가 커집니다.',
          tone: 'warn'
        },
        {
          title: '회복되는 환경',
          body: '혼자 정리할 시간, 고정된 루틴, 말보다 결과가 보이는 일에서 회복력이 살아납니다.',
          tone: 'good'
        },
        {
          title: '맞는 루틴',
          body: '수면, 식사, 일정 시작 시간을 고정하면 운의 체감이 좋아집니다. 운은 생활 리듬이 무너질 때 가장 흐려집니다.'
        },
        {
          title: '피해야 할 방식',
          body: '기분이 올라온 날 한 번에 여러 일을 벌이는 방식은 금방 피로와 후회로 돌아올 수 있습니다.'
        }
      ]
    },
    {
      id: 'life-cycle',
      title: '인생 사이클 그래프',
      subtitle: '상승기, 정체기, 전환기, 관계 변화기, 재정 압박 구간을 연도별로 봅니다.',
      cards: lifeCycleCards
    },
    {
      id: 'money-work-style',
      title: '돈 흐름과 일 스타일 분석',
      subtitle: '재물운과 직업운을 정보 나열이 아니라 실제 생활 방식으로 풉니다.',
      cards: [
        {
          title: '돈 버는 방식',
          body: '한 번 크게 벌기보다 반복 수익, 정산 기준, 제공 범위가 분명할 때 돈 흐름이 안정됩니다.'
        },
        {
          title: '돈 새는 구조',
          body: '감정적 소비, 급한 결정, 사람에게 맞추느라 생기는 지출을 먼저 줄여야 합니다.',
          tone: 'warn'
        },
        {
          title: '일 스타일',
          body: '직업 이름보다 운영형, 분석형, 브랜드형, 상담형 중 어디에서 오래 버티는지 보는 편이 현실적입니다.',
          tone: 'good'
        },
        {
          title: '협업 방식',
          body: '혼자 시작하되 반복 업무는 도구와 사람에게 나눌수록 장점이 오래 갑니다.'
        }
      ]
    },
    {
      id: 'avoid-top3',
      title: '올해 피해야 할 것 TOP3',
      subtitle: '고민이 꼬일 때 가장 먼저 줄여야 할 행동입니다.',
      bullets: [
        '감정이 올라온 날 바로 관계를 정리하거나 결론 내리기',
        '불안해서 무리한 소비, 투자, 이직 결정을 앞당기기',
        '내 체력과 시간을 계산하지 않고 책임을 더 떠안기'
      ]
    },
    {
      id: 'prescription',
      title: '사주 처방전',
      subtitle: '운세를 인생 방향 가이드로 바꾸는 실행 항목입니다.',
      callout: {
        title: '이번 고민의 처방',
        body: `${report.customerName}님에게 지금 필요한 것은 더 많이 버티는 힘이 아니라 기준을 다시 세우는 힘입니다. 수면 리듬, 돈 기록, 관계 거리, 일의 우선순위를 작게라도 고정하면 흐름이 안정됩니다.`
      },
      bullets: [
        '수면과 식사 시간을 먼저 안정시키기',
        '한 번에 여러 일 벌이지 않기',
        '중요한 관계는 말보다 약속과 행동으로 판단하기',
        '돈 흐름을 주 1회 기록하기',
        '결정 전 하루를 두고 체력, 비용, 책임 범위를 다시 보기'
      ]
    }
  ];

  return {
    ...report,
    title: '고민풀이 사주 리포트',
    subtitle: '사주 기본 구조, 십성, 신살, 대운·세운을 바탕으로 지금의 고민을 현실적으로 정리한 2,900원 입문 리포트',
    badge: 'CONCERN READING',
    heroNote: `${report.customerName}님의 원국, 십성, 특수 요소, 대운과 세운을 기준으로 지금 가장 크게 걸려 있는 고민을 해석한 리포트입니다.`,
    summary: {
      title: `${report.customerName}님의 고민풀이 핵심 요약`,
      analysis: [
        `${report.customerName}님의 기본 구조는 일간 ${report.dayMaster}, ${report.strengthLabel}, 오행 분포 ${elementFlow}를 함께 놓고 읽어야 합니다.`,
        `현재 흐름은 ${report.currentDayun.name} 대운 안에 있으며, 고민의 중심은 ${report.currentDayun.focus} 쪽으로 모입니다.`,
        `십성에서는 ${topTenGods || dominantTenGod} 흐름이 앞에 있어 감정 상태, 인간관계, 돈과 일의 선택 방식에 직접 영향을 줍니다.`,
        currentYear
          ? `${currentYear.year}년은 ${currentYear.headline} 흐름입니다. ${asSentence(currentYear.focus)} ${asSentence(currentYear.warning)} 올해는 이 두 가지를 같이 보며 움직이는 편이 좋습니다.`
          : `올해는 결론보다 기준을 다시 세우는 해로 읽는 편이 안정적입니다.`
      ],
      advice: [
        '지금 고민은 감정만 보지 말고 일정, 돈, 관계, 체력 조건까지 함께 보세요.',
        `${bestMonthText}에는 행동을 열고, ${watchMonthText}에는 속도를 줄이는 식으로 운의 리듬을 나누세요.`,
        '후속상담 없이도 스스로 점검할 수 있게, 마지막 사주 처방전의 항목을 먼저 실행하세요.'
      ]
    },
    keyTakeaways: [
      {
        title: '핵심 구조',
        body: `일간 ${report.dayMaster}, ${report.strengthLabel}, ${report.currentDayun.name} 대운이 지금 고민의 기본 배경입니다.`,
        tone: 'good'
      },
      {
        title: '감정',
        body: '지친 이유를 성격 탓으로만 보지 말고 책임, 눈치, 생각 과부하가 어디서 반복되는지 봐야 합니다.'
      },
      {
        title: '관계',
        body: '상대의 말보다 약속, 돈, 시간, 책임을 어떻게 다루는지가 관계의 진짜 신호입니다.'
      },
      {
        title: '행동',
        body: '좋은 운을 기다리기보다 지금 줄여야 할 행동과 먼저 고정할 루틴을 정하는 것이 중요합니다.',
        tone: 'good'
      },
      {
        title: '주의',
        body: `${watchMonthText}에는 감정적 소비, 성급한 관계 정리, 무리한 이직 결정을 조심하세요.`,
        tone: 'warn'
      }
    ],
    questionAnswers: report.questionAnswers.map((qa, index) => ({
      ...qa,
      title: `고민 ${index + 1} 맞춤 해석: ${qa.title}`,
      advice: [
        ...qa.advice,
        '이 고민은 결론을 빨리 내기보다 감정, 돈, 시간, 책임 범위를 나눠서 확인할 때 흔들림이 줄어듭니다.'
      ]
    })),
    sections,
    actionPlan: {
      ...report.actionPlan,
      title: '고민풀이 사주 처방전',
      priorities: [
        '1단계: 지금 고민을 감정, 돈, 관계, 일, 체력 중 어디에 속하는지 하나로 분류합니다.',
        '2단계: 올해 피해야 할 것 TOP3 중 내게 가장 가까운 항목을 먼저 줄입니다.',
        '3단계: 이번 달에는 새 결정보다 수면, 돈 기록, 관계 거리 중 하나를 고정합니다.',
        '4단계: 한 달 뒤 같은 고민이 반복되는지 행동 기록으로 확인합니다.'
      ],
      dos: [
        '고민을 한 문장으로 적고 원인과 행동을 분리하기',
        '감정이 강한 날에는 결론을 하루 미루기',
        '돈과 일정이 걸린 일은 조건을 글로 남기기',
        '관계에서는 상대 말보다 반복 행동을 보기'
      ],
      avoids: [
        '불안해서 바로 결제, 투자, 이직, 이별을 결정하기',
        '모든 책임을 혼자 떠안기',
        '좋은 말만 듣고 현실 조건을 확인하지 않기',
        '몸이 지친 상태에서 중요한 관계 대화 시작하기'
      ]
    }
  };
}

void buildConcernReadingReport;

function getElementRole(element: string) {
  const roles: Record<string, string> = {
    목: '목은 방향, 성장, 관계의 목적을 세우는 기운입니다. 부족하면 어디까지 이어갈지 결정이 늦어지고, 보완되면 선택지가 정리됩니다.',
    화: '화는 조후와 표현의 역할을 합니다. 차가운 판단을 사람의 온도와 실행력으로 데워주고, 생각을 실제 행동으로 옮기게 합니다.',
    토: '토는 중심, 기준, 수용의 축입니다. 흔들리는 마음을 붙잡고 돈, 일정, 책임 범위를 현실적으로 정리하게 만듭니다.',
    금: '금은 판단, 정리, 결과물의 기운입니다. 강하면 기준이 날카로워지고, 약하면 마무리와 거절이 어려워집니다.',
    수: '수는 돈, 정보, 이동, 감정의 흐름입니다. 살아나면 기회가 많아지지만, 과하면 생각과 변수가 많아져 피로가 커집니다.'
  };

  return roles[element] || `${element} 기운은 현재 고민에서 균형을 맞춰야 할 보조 기준입니다.`;
}

function hasConcernKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function asSentence(text?: string) {
  const trimmed = (text || '').trim();

  if (!trimmed) {
    return '';
  }

  return /[.!?。！？]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function hasFinalConsonant(text: string) {
  const hangul = text.replace(/[^\uAC00-\uD7A3]/g, '');
  const last = hangul[hangul.length - 1];

  if (!last) {
    return false;
  }

  return (last.charCodeAt(0) - 0xac00) % 28 !== 0;
}

function withObjectParticle(text: string) {
  return `${text}${hasFinalConsonant(text) ? '을' : '를'}`;
}

function withTopicParticle(text: string) {
  return `${text}${hasFinalConsonant(text) ? '은' : '는'}`;
}

function withSubjectParticle(text: string) {
  return `${text}${hasFinalConsonant(text) ? '이' : '가'}`;
}

function formatElementList(elements: string[]) {
  return Array.from(new Set(elements.filter(Boolean))).join('·');
}

function buildConcernCautionLabel(elements: string[]) {
  const unique = Array.from(new Set(elements.filter(Boolean)));
  const speedElements = unique.filter((element) => element !== '목');
  const labels: string[] = [];

  if (speedElements.length) {
    labels.push(`${formatElementList(speedElements)} 과속 조절`);
  }

  if (unique.includes('목')) {
    labels.push('목은 보완하되 무리한 확장 주의');
  }

  return labels.join(', ') || '과속 흐름 조절';
}

function buildConcernCautionSentence(elements: string[]) {
  const unique = Array.from(new Set(elements.filter(Boolean)));
  const speedElements = unique.filter((element) => element !== '목');
  const sentences: string[] = [];

  if (speedElements.length) {
    sentences.push(`${formatElementList(speedElements)} 기운이 강해질 때는 정보, 돈, 감정 반응의 속도를 기록으로 늦춰야 합니다.`);
  }

  if (unique.includes('목')) {
    sentences.push('목은 부족하다고 밀어붙일 기운이 아니라, 관계 방향과 성장 계획을 천천히 세우는 방식으로 보완해야 합니다.');
  }

  return sentences.join(' ');
}

const CONCERN_YEAR_ROLES = [
  {
    title: '공개와 테스트',
    body: '준비한 결과물을 작게 내보내고 반응을 확인하는 해입니다. 완성도를 끝없이 붙잡기보다, 고객이 실제로 어디에서 멈추고 어디에서 결제하는지 보는 쪽이 핵심입니다.'
  },
  {
    title: '고객층 확장',
    body: '소개, 반복 구매, 협업 제안이 늘어나는 흐름입니다. 바빠지는 것과 돈이 남는 것은 다르므로 응대 시간, 단가, 수정 범위를 먼저 나눠야 합니다.'
  },
  {
    title: '구조 조정',
    body: '잘 팔리는 것과 손이 많이 가는 것을 분리하는 해입니다. 새 메뉴를 늘리기보다 환불 기준, 마감 기준, 상담 흐름을 다시 짜야 피로가 줄어듭니다.'
  },
  {
    title: '수익 모델 고정',
    body: '반복 결제, 다시보기, 예약형 리포트처럼 돈이 남는 방식을 고정하는 흐름입니다. 가까운 사람 부탁이나 할인 요구에 가격표가 흔들리지 않게 해야 합니다.'
  },
  {
    title: '재정비와 선택',
    body: '계속 가져갈 일과 내려놓을 일을 나누는 시기입니다. 체력과 시간에 맞지 않는 관계나 상품을 정리해야 다음 주기의 기회가 들어올 자리가 생깁니다.'
  }
] as const;

function buildConcernLifeCycleCards(report: SajuReportData): NonNullable<ReportSection['cards']> {
  return report.yearLuck.slice(0, 5).map((item, index) => {
    const role = CONCERN_YEAR_ROLES[index] || CONCERN_YEAR_ROLES[CONCERN_YEAR_ROLES.length - 1];

    return {
      title: `${item.year}년 · ${role.title}`,
      body: `${getLuckPhase(item.score)} 역할로 읽습니다. ${role.body}`,
      tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
    };
  });
}

function buildConcernDirectAnswer(
  qa: SajuReportData['questionAnswers'][number],
  index: number,
  report: SajuReportData,
  dominantTenGod: string,
  bestMonthText: string,
  watchMonthText: string
): SajuReportData['questionAnswers'][number] {
  const question = qa.question || '';
  const isCareer = hasConcernKeyword(question, ['뭐하고', '직업', '일', '사업', '진로', '돈벌', '먹고', '살까']);
  const isMarriage = hasConcernKeyword(question, ['결혼', '혼인', '배우자', '시집', '장가']);
  const isLove = hasConcernKeyword(question, ['연애', '인연', '상대', '썸', '재회', '사랑']);
  const isMoney = hasConcernKeyword(question, ['돈', '재물', '투자', '수입', '매출', '가격']);

  if (isSelfHarmQuestion(question)) {
    const address = getCasualAddressParts(report.customerName);
    const isExistential = isExistentialCrisisQuestion(question) || index > 0;

    return {
      ...qa,
      title: isExistential
        ? `고민 ${index + 1} 결론: ${address.titleLead} 인생 답을 혼자 결론내리면 안 돼`
        : `고민 ${index + 1} 결론: ${address.titleLead} 혼자 버티는 날이 아니야`,
      analysis: isExistential
        ? `${address.opening} 이 고민은 “왜 살아야 하지”라는 말로 보이지만, 실제로는 몸과 마음이 한계까지 밀렸다는 신호야. ${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 같이 보면 책임, 돈, 관계, 피로가 한꺼번에 몰릴 때 생각이 혼자 깊어지고 세상과 끊기고 싶어지는 장면이 생겨. ${address.subject} 지금 인생 결론을 낼 상태가 아니야. 오늘은 의미를 찾기보다 사람 옆에 붙어 있어야 해.`
        : `${address.opening} 이 고민은 운세로 맞히거나 단정할 문제가 아니야. ${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 보면 책임, 돈, 관계, 피로가 한꺼번에 몰릴 때 혼자 버티다가 세상과 끊기고 싶어지는 장면이 생겨. 하지만 지금 필요한 답은 “운이 좋다/나쁘다”가 아니라 ${address.object} 붙잡아 줄 사람과 안전한 공간이야. 오늘은 혼자 있으면 안 돼.`,
      advice: [
        `${address.aloneLine} 가까운 사람에게 “나 지금 혼자 있으면 위험해. 같이 있어줘”라고 바로 보내.`,
        '술, 약, 칼, 끈, 높은 곳, 차 키처럼 자신을 다치게 할 수 있는 물건과 장소에서 지금 바로 떨어져.',
        '한국이면 자살예방 상담전화 109로 전화해. 지금 당장 위험하면 119나 112로 바로 전화해. 해외라면 현지 응급번호나 가까운 응급실로 가.',
        '오늘은 인생 결론을 내리는 날이 아니라 다음 10분을 안전하게 넘기는 날이야.'
      ]
    };
  }

  if (isCareer) {
    return {
      ...qa,
      title: `고민 ${index + 1} 결론: 일과 진로`,
      analysis: `결론부터 말하면, ${report.customerName}님은 완전한 조직 순응형보다 상담·분석·기획·콘텐츠화처럼 자기 기준을 결과물로 보여주는 일이 맞습니다. 특히 자료 정리, 분석형 업무, 교육·설명, 운영 설계, 데이터 정리형 기획 업무와 잘 맞습니다. 실제 장면으로 보면 흩어진 정보를 표로 정리하거나, 말로만 떠도는 문제를 결론·근거·행동 순서로 바꿔주는 일에서 힘이 살아납니다. ${dominantTenGod} 흐름은 “남이 시킨 일을 오래 버티는 힘”보다 “내 기준으로 설명하고 설계하는 힘”으로 쓸 때 만족도가 커집니다.`,
      advice: [
        '처음부터 큰 사업이나 큰 이직을 벌이기보다, 지금 가진 경험을 포트폴리오·성과 기록·업무 매뉴얼처럼 보이는 결과물로 바꾸는 게 먼저입니다.',
        '직업명으로 찾지 말고 상담형, 분석형, 기획형, 콘텐츠형, 운영형 중 어느 방식에서 덜 지치고 오래 설명할 수 있는지 먼저 보세요.',
        '이번 달에는 내가 돈을 받을 수 있는 역할 하나를 정하고 대가, 책임 범위, 마감 시간, 협업 기준을 한 화면에 적어두세요.'
      ]
    };
  }

  if (isMarriage) {
    return {
      ...qa,
      title: `고민 ${index + 1} 결론: 결혼 가능성`,
      analysis: `가능성은 있습니다. 다만 빠른 연애나 뜨거운 감정보다 생활 기준이 맞는 안정형 인연이 결혼으로 이어질 확률이 높습니다. ${report.customerName}님은 말이 많은 사람보다 약속, 돈, 시간, 가족과의 거리, 감정 회복 방식이 일정한 사람과 맞습니다. 처음에는 무난해 보여도 상대가 약속을 자주 바꾸거나 돈 이야기를 흐리면 마음이 빨리 피곤해질 수 있습니다. 결혼운은 “언제 만나느냐”보다 “만난 뒤 생활을 유지할 조건이 맞느냐”에서 갈립니다.`,
      advice: [
        '결혼을 보려면 호감보다 주거, 돈, 가족 거리, 일의 리듬을 먼저 확인하세요.',
        `${bestMonthText}에는 관계를 현실 주제로 꺼내기 좋고, ${watchMonthText}에는 결론을 서두르지 않는 편이 좋습니다.`,
        '상대가 갈등을 피하기만 하거나 책임을 흐리면 인연이 있어도 결혼 안정성은 낮아집니다.'
      ]
    };
  }

  if (isLove) {
    return {
      ...qa,
      title: `고민 ${index + 1} 결론: 연애와 인연`,
      analysis: `지금 연애 고민은 상대 마음을 맞히는 문제보다, ${report.customerName}님이 어떤 관계에서 안정감을 느끼고 어떤 관계에서 소모되는지 구분하는 문제에 가깝습니다. 답장을 기다리며 혼자 결론을 내리거나, 상대는 괜찮다고 했는데 나만 오래 신경 쓰는 장면이 반복될 수 있습니다. 끌림은 생길 수 있지만 오래 가는 인연은 연락의 양보다 약속의 질, 감정 표현보다 생활 배려에서 갈립니다.`,
      advice: [
        '상대의 말보다 반복 행동을 보세요. 일정, 약속, 돈, 갈등 후 태도가 핵심입니다.',
        '불안해서 연락을 늘리는 방식은 관계를 무겁게 만들 수 있으니 짧고 분명한 제안이 좋습니다.',
        `${watchMonthText}에는 상대 반응을 확인하려고 몰아붙이기보다 내 감정의 기준을 먼저 정리하세요.`
      ]
    };
  }

  if (isMoney) {
    return {
      ...qa,
      title: `고민 ${index + 1} 결론: 돈 흐름`,
      analysis: `돈은 들어올 수 있지만, 지금은 크게 한 번 벌기보다 새는 구조를 막고 반복 수익을 만드는 쪽이 더 안정적입니다. ${report.customerName}님에게 맞는 돈 흐름은 충동적 확장보다 가격표, 정산 기준, 제공 범위가 분명한 구조에서 살아납니다. 사람 정 때문에 할인하거나 급한 마음에 새 결제를 누르면 수익보다 피로가 먼저 남을 수 있습니다.`,
      advice: [
        '투자보다 현금 방어와 기록이 먼저입니다.',
        '수입을 늘리려면 단건 판매보다 반복 구매, 다시보기, 추가 리포트처럼 이어지는 구조가 좋습니다.',
        '이번 달에는 지출을 감정 소비, 관계 지출, 일 지출로 나눠 적어보세요.'
      ]
    };
  }

  return {
    ...qa,
    title: `고민 ${index + 1} 결론`,
    analysis: `결론부터 말하면, 이 고민은 감정 하나로 결정할 문제가 아니라 사람, 돈, 시간, 체력 조건을 나눠 확인해야 풀립니다. ${report.customerName}님은 빠른 답보다 기준을 세운 뒤 움직일 때 손실이 줄어드는 구조입니다. 지금 답답한 이유는 의지가 약해서가 아니라, 여러 조건이 한꺼번에 엉켜 있는데 마음만 먼저 결론을 내리려 하기 때문입니다.`,
    advice: [
      '고민을 감정, 돈, 관계, 일, 체력 중 하나로 먼저 분류하세요.',
      `${bestMonthText}에는 작은 실행을 열고, ${watchMonthText}에는 속도를 줄이세요.`,
      '결론을 내리기 전에 책임 범위와 비용을 먼저 적어보세요.'
    ]
  };
}

function buildConcernReadingReportV2(report: SajuReportData, options: { preserveQuestionAnswers?: boolean } = {}): SajuReportData {
  if (report.serviceId !== 'concern-reading') {
    return report;
  }

  const dominantTenGod = report.tenGods[0]?.label || '주요 십성';
  const secondTenGod = report.tenGods[1]?.label || '보조 십성';
  const currentYear = report.yearLuck[0];
  const bestMonth = [...report.monthLuck].sort((left, right) => right.score - left.score)[0];
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];
  const bestMonthText = bestMonth ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} ${getLuckPhase(bestMonth.score)}` : '흐름이 열리는 달';
  const watchMonthText = watchMonth ? `${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} ${getLuckPhase(watchMonth.score)}` : '속도를 줄일 달';
  const topTenGods = report.tenGods
    .slice(0, 3)
    .map((item) => item.label)
    .join(' · ');
  const helpfulText = formatElementList(report.helpfulElements) || '균형 오행';
  const cautiousText = buildConcernCautionLabel(report.cautiousElements);
  const cautionSentence = buildConcernCautionSentence(report.cautiousElements);
  const directAnswers = options.preserveQuestionAnswers
    ? report.questionAnswers
    : report.questionAnswers.map((qa, index) =>
        buildConcernDirectAnswer(qa, index, report, dominantTenGod, bestMonthText, watchMonthText)
      );
  const tenGodRows = report.tenGods.slice(0, 8).map((item) => [
    item.label,
    String(item.value),
    item.value >= 3
      ? '강하게 드러나는 행동 패턴입니다. 장점으로 쓰면 추진력이 되고, 과하면 반복 피로가 됩니다.'
      : item.value === 2
        ? '상황에 따라 안정적으로 작동합니다. 고민의 종류에 따라 장점과 부담이 함께 나옵니다.'
        : '부족하거나 약하게 드러나는 영역입니다. 의식적으로 보완하면 체감 만족도가 커집니다.'
  ]);
  const lifeCycleCards = buildConcernLifeCycleCards(report);
  const yongsinCards = report.helpfulElements.map((element) => ({
    title: `${element} 보완 기준`,
    body: getElementRole(element),
    tone: 'good' as const
  }));

  const sections: ReportSection[] = [
    {
      id: 'concern-structure',
      title: '1. 사주 기본 구조 분석',
      subtitle: '네 기둥과 여덟 글자를 먼저 보고, 고민이 어디서 반복되는지 잡습니다.',
      callout: {
        title: '결론 먼저',
        body: `${report.customerName}님의 고민은 성격 탓으로만 볼 문제가 아닙니다. 일간 ${report.dayMaster}, ${report.strengthLabel}, 현재 ${report.currentDayun.name} 대운이 만나면서 “혼자 버티기, 결정 직전 흔들림, 관계와 돈의 기준 문제”가 함께 켜진 흐름입니다.`
      },
      table: {
        headers: ['기둥', '계산값', '고민에서 보는 의미'],
        rows: [
          ['연주', report.pillars.year, '초년 배경과 바깥에서 보이는 이미지'],
          ['월주', report.pillars.month, '사회성, 일 스타일, 조직과 생활 기준'],
          ['일주', report.pillars.day, '나 자신, 관계에서 반복되는 감정 기준'],
          ['시주', report.pillars.hour || '시간 미상', '결과를 만드는 습관과 후반 흐름']
        ]
      },
      details: [
        {
          summary: '왜 네 기둥부터 보는가',
          content:
            '사주는 네 기둥과 여덟 글자 구조를 기본으로 보고, 운은 시간에 따라 바뀌는 흐름으로 봅니다. 그래서 지금 고민은 원국만 보아도 부족하고, 대운·세운이 원국을 어떻게 건드리는지 함께 읽어야 실제 체감과 맞습니다.',
          open: true
        }
      ]
    },
    {
      id: 'concern-ten-gods',
      title: '2. 십성(十星) 확인',
      subtitle: '십성은 일간 기준으로 해석합니다. 개수보다 위치와 반복 행동이 더 중요합니다.',
      callout: {
        title: `핵심 십성: ${topTenGods || dominantTenGod}`,
        body: `${dominantTenGod}과 ${secondTenGod} 흐름이 고민의 표현 방식을 크게 좌우합니다. 혼자 책임지는지, 생각이 과열되는지, 말과 현실이 충돌하는지, 사람 눈치를 먼저 보는지가 여기서 갈립니다.`
      },
      table: {
        headers: ['십성', '개수', '고민에서 드러나는 방식'],
        rows: tenGodRows
      },
      cards: [
        {
          title: '비견·겁재',
          body: '강하면 혼자 책임지려는 압박, 약하면 내 기준을 지키기 어려운 문제로 나타납니다.'
        },
        {
          title: '식신·상관',
          body: '생각, 말, 표현, 결과물의 축입니다. 강하면 콘텐츠와 설명 능력이 좋지만 현실과 부딪힐 수 있습니다.'
        },
        {
          title: '정재·편재',
          body: '돈, 고객, 선택지, 현실 감각입니다. 재성이 움직이면 기회도 늘지만 지출과 책임도 함께 커집니다.'
        },
        {
          title: '관성·인성',
          body: '책임, 규칙, 보호, 공부의 축입니다. 과하면 눈치와 시뮬레이션이 많아져 결정 피로가 생깁니다.'
        }
      ]
    },
    {
      id: 'concern-yongsin',
      title: '3. 용신·희기 판단',
      subtitle: '왜 어떤 기운은 살리고 어떤 기운은 조절해야 하는지 명리 근거를 분명히 봅니다.',
      callout: {
        title: `${helpfulText} 기운은 보완축, ${cautiousText}`,
        body: '용신은 항상 좋은 오행이라는 뜻이 아니라, 명식의 치우침을 현실에서 바로잡는 기준입니다. 고민풀이에서는 이 기준을 직업, 관계, 돈, 생활 리듬으로 번역합니다.'
      },
      cards: [
        ...yongsinCards,
        {
          title: '희기 판단',
          body: `${cautionSentence || '과해지는 기운은 나쁘다고만 볼 것이 아니라 속도 조절이 필요한 신호입니다.'} 그래서 결론을 빨리 내기보다 기록, 가격표, 일정표처럼 확인 가능한 기준을 먼저 세워야 합니다.`,
          tone: 'warn'
        }
      ]
    },
    {
      id: 'concern-special',
      title: '4. 특수 요소 분석',
      subtitle: '귀인, 매력살, 합충형해파, 십이신살, 간여지동을 실제 고민 장면으로 풉니다.',
      cards: [
        {
          title: '귀인 분석',
          body: '귀인은 막연한 행운보다 “문제를 풀어주는 사람”으로 봐야 합니다. 이 리포트에서는 말만 좋은 사람보다 일정, 자료, 금전 조건을 같이 정리해주는 사람이 실제 귀인에 가깝습니다.',
          tone: 'good'
        },
        {
          title: '매력살 분석',
          body: '도화, 홍염, 화개살은 인기 점수가 아니라 주목받는 방식입니다. 처음엔 조용해 보여도 말이 정리되고 결과가 보일 때 신뢰가 붙는지, 혹은 감정선이 깊어질수록 상대가 끌리는지를 봅니다.'
        },
        {
          title: '합충형해파',
          body: '합충형해파는 사건이 커지는 접점입니다. 연락, 돈, 일정, 책임이 한꺼번에 맞물릴 때 갑자기 피로가 올라오거나 관계를 정리하고 싶어지는 장면을 여기서 읽습니다.',
          tone: 'warn'
        },
        {
          title: '십이신살·간여지동',
          body: '같은 유형의 사람, 같은 돈 문제, 같은 결정 피로가 반복되는지 확인합니다. 단순 성격이 아니라 특정 상황에서 자동으로 켜지는 반응을 찾는 보조 항목입니다.'
        }
      ],
      details: [
        {
          summary: '제공되는 분석 항목',
          content:
            '귀인 분석, 매력살 분석, 합충형해파, 십성 분포, 신강/신약, 대운/세운, 신살 분석, 간여지동, 월간 운세, 종합 정리를 한 리포트 안에서 확인합니다.',
          open: true
        }
      ]
    },
    {
      id: 'concern-period',
      title: '5. 대운·세운 시기 분석',
      subtitle: '현재와 향후 10년 대운, 올해와 내년 세운의 선택 기준을 봅니다.',
      cards: [
        {
          title: `현재 대운 · ${report.currentDayun.name}`,
          body: `${report.currentDayun.range} 구간입니다. ${asSentence(report.currentDayun.focus)} ${asSentence(report.currentDayun.caution)}`,
          tone: 'good'
        },
        {
          title: `다음 대운 · ${report.nextDayun.name}`,
          body: `${report.nextDayun.range} 구간입니다. ${report.nextDayun.summary}`
        },
        {
          title: currentYear ? `${currentYear.year}년 세운` : '올해 세운',
          body: currentYear
            ? `${asSentence(currentYear.headline)} ${asSentence(currentYear.focus)} ${asSentence(currentYear.warning)}`
            : '올해 흐름은 현재 대운과 원국의 충돌 지점을 함께 보아야 정확합니다.'
        },
        {
          title: '월간 운세',
          body: `${bestMonthText}에는 작은 실행을 열고, ${watchMonthText}에는 정리와 회복을 우선하세요.`,
          tone: 'warn'
        }
      ]
    },
    {
      id: 'concern-custom',
      title: '6. 고민별 맞춤 해석',
      subtitle: '고객이 입력한 고민에 대해 첫 문장부터 결론을 제시합니다.',
      cards: [
        {
          title: '일·직업',
          body: '상담형 콘텐츠, 분석형 서비스, 가격표가 있는 지식판매, 반복형 온라인 상품처럼 기준을 상품화하는 일이 맞습니다.',
          tone: 'good'
        },
        {
          title: '결혼·관계',
          body: '가능성은 보되 생활 기준, 돈의 태도, 가족과의 거리, 갈등 회복 방식이 맞아야 결혼 안정성이 올라갑니다.'
        },
        {
          title: '돈 흐름',
          body: '투자보다 현금 방어, 가격표, 정산 기준, 반복 수익 구조가 먼저입니다.'
        },
        {
          title: '행동 기준',
          body: '감정이 강한 날일수록 결론보다 조건 확인이 먼저입니다.',
          tone: 'warn'
        }
      ],
      details: directAnswers.map((qa, index) => ({
        summary: qa.title || `고민 ${index + 1}`,
        content: `${qa.analysis}\n\n실행 조언: ${qa.advice.join(' ')}`,
        open: true
      }))
    },
    {
      id: 'emotion-pattern',
      title: '감정 상태 분석',
      subtitle: '지금 마음이 왜 지치고, 왜 결정 직전에 흔들리는지 봅니다.',
      cards: [
        {
          title: '혼자 버티는 압박',
          body: '비겁 흐름이 강하게 작동하면 책임을 나눠야 할 상황에서도 혼자 감당하려는 습관이 생깁니다.'
        },
        {
          title: '생각 과부하',
          body: '인성 흐름이 과하면 시작 전부터 실패 가능성을 먼저 떠올리고, 결정 직전에 머리가 복잡해집니다.',
          tone: 'warn'
        },
        {
          title: '표현과 현실의 충돌',
          body: '식상 흐름은 말하고 싶은 것과 실제 가능한 조건 사이의 간격을 크게 느끼게 합니다.'
        },
        {
          title: '사람 눈치',
          body: '관성 흐름은 책임감으로 쓰면 강점이지만, 과하면 상대 반응을 지나치게 먼저 읽게 만듭니다.'
        }
      ]
    },
    {
      id: 'relationship-pattern',
      title: '인간관계 패턴 분석',
      subtitle: '어떤 사람에게 끌리고, 어떤 관계에서 반복적으로 상처받는지 봅니다.',
      bullets: [
        '처음에는 잘 맞는 것 같지만 시간이 지나며 책임을 혼자 떠안는 관계를 조심해야 합니다.',
        '상대의 말보다 약속, 일정, 돈, 태도가 반복되는지 보는 편이 정확합니다.',
        '도움이 되는 인맥은 감정적으로 뜨거운 사람보다 기준을 지켜주는 사람입니다.',
        '끊어야 할 관계는 내 생활 리듬과 자존감을 계속 흔드는 관계입니다.'
      ]
    },
    {
      id: 'energy-battery',
      title: '사주 에너지 배터리 분석',
      subtitle: '어떤 상황에서 기가 빨리고, 어디서 회복되는지 정리합니다.',
      cards: [
        {
          title: '소모되는 환경',
          body: '성과 압박, 책임 전가, 애매한 약속이 반복되는 환경에서는 에너지 소모가 커집니다.',
          tone: 'warn'
        },
        {
          title: '회복되는 환경',
          body: '혼자 정리할 시간, 고정된 루틴, 말보다 결과가 보이는 일에서 회복력이 살아납니다.',
          tone: 'good'
        },
        {
          title: '맞는 루틴',
          body: '수면, 식사, 일정 시작 시간을 고정하면 운의 체감이 좋아집니다.'
        },
        {
          title: '피해야 할 방식',
          body: '기분이 올라온 날 한 번에 여러 일을 벌이면 금방 피로와 후회로 돌아올 수 있습니다.'
        }
      ]
    },
    {
      id: 'life-cycle',
      title: '인생 사이클 그래프',
      subtitle: '상승기, 정체기, 전환기, 관계 변화기, 재정 압박 구간을 연도별로 봅니다.',
      cards: lifeCycleCards
    },
    {
      id: 'money-work-style',
      title: '돈 흐름과 일 스타일 분석',
      subtitle: '재물운과 직업운을 실제 생활 방식으로 바꿔 읽습니다.',
      cards: [
        {
          title: '돈 버는 방식',
          body: '한 번 크게 벌기보다 반복 수익, 정산 기준, 제공 범위가 분명할 때 돈 흐름이 안정됩니다.'
        },
        {
          title: '돈 새는 구조',
          body: '감정 소비, 급한 결정, 사람에게 맞추느라 생기는 지출을 먼저 줄여야 합니다.',
          tone: 'warn'
        },
        {
          title: '일 스타일',
          body: '조직형보다 상담형, 분석형, 브랜드형, 운영형에서 장점이 오래 갑니다.',
          tone: 'good'
        },
        {
          title: '협업 방식',
          body: '혼자 시작하되 반복 업무는 도구와 사람에게 나눌수록 장점이 유지됩니다.'
        }
      ]
    },
    {
      id: 'avoid-top3',
      title: '올해 피해야 할 것 TOP3',
      subtitle: '고민이 꼬일 때 가장 먼저 줄여야 할 행동입니다.',
      bullets: [
        '감정이 올라온 날 바로 관계를 정리하거나 결론 내리기',
        '불안해서 무리한 소비, 투자, 이직 결정을 앞당기기',
        '내 체력과 시간을 계산하지 않고 책임을 더 떠안기'
      ]
    },
    {
      id: 'prescription',
      title: '사주 처방전',
      subtitle: '운세를 인생 방향 가이드로 바꾸는 실행 항목입니다.',
      callout: {
        title: '이번 고민의 처방',
        body: `${report.customerName}님에게 지금 필요한 것은 더 많이 버티는 힘이 아니라 기준을 다시 세우는 힘입니다. 수면 리듬, 돈 기록, 관계 거리, 일의 우선순위를 작게라도 고정하면 흐름이 안정됩니다.`
      },
      bullets: [
        '수면과 식사 시간을 먼저 안정시키기',
        '한 번에 여러 일 벌이지 않기',
        '중요한 관계는 말보다 약속과 행동으로 판단하기',
        '돈 흐름을 주 1회 기록하기',
        '결정 전 하루를 두고 체력, 비용, 책임 범위를 다시 보기'
      ]
    }
  ];

  return {
    ...report,
    title: '고민풀이 사주 리포트',
    subtitle: '사주 구조, 십성, 신살, 용신·희기, 대운·세운으로 지금의 고민을 결론형으로 정리한 2,900원 입문 리포트',
    badge: 'CONCERN READING',
    heroNote: `${report.customerName}님의 원국, 십성, 용신·희기, 대운과 세운을 기준으로 지금 가장 크게 걸려 있는 고민을 풀어낸 리포트입니다.`,
    summary: {
      title: `${report.customerName}님의 고민풀이 핵심 결론`,
      analysis: [
        `결론부터 말하면, ${report.customerName}님은 빠른 답보다 기준을 세운 뒤 움직일 때 손실이 줄어드는 구조입니다.`,
        `현재 ${report.currentDayun.name} 대운에서는 ${report.currentDayun.focus} 쪽 압력이 먼저 켜집니다. 그래서 이 고민은 마음의 문제가 아니라 사람, 돈, 일정, 체력이 한꺼번에 걸리는 선택으로 봐야 합니다.`,
        `십성에서는 ${topTenGods || dominantTenGod} 흐름이 앞에 있어 감정 상태, 인간관계, 돈과 일의 선택 방식에 직접 영향을 줍니다.`,
        currentYear
          ? `${currentYear.year}년은 ${asSentence(currentYear.headline)} ${asSentence(currentYear.focus)} ${asSentence(currentYear.warning)}`
          : '올해는 결론보다 기준을 다시 세우는 해로 읽는 편이 안정적입니다.',
        `용신·희기 기준으로는 ${withObjectParticle(`${helpfulText} 기운`)} 현실에서 보완해야 합니다. ${cautionSentence || `${cautiousText} 기준으로 속도를 조절하는 것이 핵심입니다.`}`
      ],
      advice: [
        '지금 고민은 감정만 보지 말고 일정, 돈, 관계, 체력 조건까지 함께 보세요.',
        `${bestMonthText}에는 작은 실행을 열고, ${watchMonthText}에는 정리와 회복을 우선하세요.`,
        '고민 답변은 마지막에 미루지 말고, 입력한 질문별 결론을 먼저 확인하세요.'
      ]
    },
    keyTakeaways: [
      {
        title: '결론',
        body: '설명보다 기준이 먼저입니다. 올해는 무엇을 더 할지보다 무엇을 줄일지 정해야 고민이 풀립니다.',
        tone: 'good'
      },
      {
        title: '일',
        body: '상담형 콘텐츠, 분석형 서비스, 지식판매, 반복형 온라인 상품처럼 기준을 상품화하는 방향이 맞습니다.'
      },
      {
        title: '관계',
        body: '가능성보다 생활 기준이 중요합니다. 약속, 돈, 시간, 갈등 회복 방식이 맞는 사람이 오래 갑니다.'
      },
      {
        title: '돈',
        body: '투자보다 현금 방어와 반복 수익 구조가 먼저입니다.',
        tone: 'good'
      },
      {
        title: '주의',
        body: `${watchMonthText}에는 감정적 소비, 성급한 관계 정리, 무리한 이직 결정을 조심하세요.`,
        tone: 'warn'
      }
    ],
    questionAnswers: directAnswers,
    sections,
    actionPlan: {
      ...report.actionPlan,
      title: '고민풀이 사주 처방전',
      priorities: [
        '1단계: 지금 고민을 감정, 돈, 관계, 일, 체력 중 어디에 속하는지 하나로 분류합니다.',
        '2단계: 올해 피해야 할 것 TOP3 중 내게 가장 가까운 항목을 먼저 줄입니다.',
        '3단계: 이번 달에는 새 결정보다 수면, 돈 기록, 관계 거리 중 하나를 고정합니다.',
        '4단계: 한 달 뒤 같은 고민이 반복되는지 행동 기록으로 확인합니다.'
      ],
      dos: [
        '고민을 한 문장으로 적고 원인과 행동을 분리하기',
        '감정이 강한 날에는 결론을 하루 미루기',
        '돈과 일정이 걸린 일은 조건을 글로 남기기',
        '관계에서는 상대 말보다 반복 행동을 보기'
      ],
      avoids: [
        '불안해서 바로 결제, 투자, 이직, 이별을 결정하기',
        '모든 책임을 혼자 떠안기',
        '좋은 말만 듣고 현실 조건을 확인하지 않기',
        '몸이 지친 상태에서 중요한 관계 대화 시작하기'
      ]
    }
  };
}

function getYearlyOpeningMetaphor(score?: number) {
  if ((score || 0) >= 80) {
    return '올해는 닫혀 있던 문이 한꺼번에 열리는 장마 뒤 햇빛 같은 해입니다. 사람도 돈도 움직이지만, 손에 잡히는 그릇이 없으면 금방 흘러갑니다.';
  }

  if ((score || 0) >= 68) {
    return '올해는 얼어 있던 강이 서서히 녹는 해입니다. 멈춰 있던 연락, 제안, 돈의 길이 다시 움직입니다. 다만 성급히 뛰어들면 발이 빠지고, 순서를 기다리면 큰 판이 열립니다.';
  }

  if ((score || 0) >= 56) {
    return '올해는 비 온 뒤 집 안을 다시 정리하는 해입니다. 겉으로 화려한 확장보다 오래 묵은 관계, 돈 습관, 일의 방식을 치우는 사람이 이깁니다.';
  }

  return '올해는 안개 낀 산길을 천천히 내려오는 해입니다. 급하게 뛰면 길을 잃고, 발밑을 확인하면 오히려 손실 없이 다음 판을 준비합니다.';
}

function getMonthBehaviorTheme(month: number) {
  const themes = [
    '시작은 작게 열고 약속은 반드시 글로 남기는 달',
    '돈보다 신뢰를 먼저 쌓아야 하는 달',
    '계약은 좋지만 역할이 흐린 동업은 피해야 하는 달',
    '오래 미룬 관계와 지출 습관을 정리하는 달',
    '전 연인, 과거 고객, 끊긴 연락이 다시 건드려지는 달',
    '말투 하나로 관계 온도가 바뀌는 달',
    '감정 폭발로 사람을 끊기 쉬운 달',
    '기술, 공부, 포트폴리오를 다듬어야 하는 달',
    '공개, 제안, 소개운이 살아나는 달',
    '돈보다 자리 잡는 선택이 중요한 달',
    '성과가 보여도 체력과 수면을 먼저 지켜야 하는 달',
    '마무리와 정산을 끝내야 다음 해가 가벼워지는 달'
  ];

  return themes[(month - 1) % themes.length];
}

function getMonthlyMoneyLine(score: number) {
  if (score >= 80) return '돈: 제안, 결제, 재구매가 붙기 쉽습니다. 단가를 낮추기보다 제공 범위를 또렷하게 보여주세요.';
  if (score >= 68) return '돈: 수입 기회는 있지만 계산을 흐리면 남지 않습니다. 가격표, 정산일, 취소 조건을 먼저 고정하세요.';
  if (score >= 56) return '돈: 새 투자보다 새는 돈을 막는 달입니다. 구독, 충동구매, 사람 때문에 쓰는 비용을 끊어야 합니다.';
  return '돈: 큰 지출과 급한 투자는 피하세요. “이번만” 하고 나가는 돈이 반복 손실로 바뀝니다.';
}

function getMonthlyLoveLine(month: number, score: number) {
  if ([5, 9, 11].includes(month)) {
    return '연애: 과거 인연이나 애매한 연락이 다시 흔들 수 있습니다. 설렘보다 상대의 반복 행동을 보세요.';
  }

  if (score >= 75) return '연애: 새 만남과 소개가 열립니다. 단, 뜨거운 말보다 약속을 지키는 사람을 우선 보세요.';
  if (score >= 60) return '연애: 관계를 서두르기보다 대화의 온도를 맞추는 달입니다. 긴 설명보다 짧은 확인 질문이 좋습니다.';
  return '연애: 혼자 결론 내리기 쉬운 달입니다. 답장이 늦다고 바로 끝내지 말고 하루 뒤 다시 판단하세요.';
}

function getMonthlyHealthLine(score: number) {
  if (score >= 75) return '건강: 움직임은 좋지만 과로가 붙기 쉽습니다. 일정이 늘면 수면 시간을 먼저 잠가야 합니다.';
  if (score >= 60) return '건강: 소화, 어깨, 눈 피로처럼 일상 피로가 쌓이기 쉽습니다. 늦은 밤 결정을 줄이세요.';
  return '건강: 새벽 생활과 야식이 멘탈을 흔듭니다. 몸이 무거운 날에는 약속을 줄이는 게 운을 지키는 일입니다.';
}

function buildYearlyMonthlyDetail(item: SajuReportData['monthLuck'][number], report: SajuReportData) {
  const phase = getLuckPhase(item.score);
  const action = getLuckAction(item.score);
  const month = item.month;

  return [
    `총운: ${item.year}.${String(month).padStart(2, '0')}은 ${phase}입니다. ${getMonthBehaviorTheme(month)}입니다. ${item.ganzhi} 월운이 들어오면 마음은 빨라지지만 실제 결과는 약속, 돈, 일정이 정리될 때 붙습니다.`,
    `사건성 있는 장면: ${month % 4 === 1 ? '끊긴 연락이나 미뤄진 제안이 다시 들어옵니다. 바로 반응하지 말고 조건부터 확인하세요.' : month % 4 === 2 ? '말실수 하나로 관계 온도가 바뀝니다. 긴 설명보다 짧은 확인이 낫습니다.' : month % 4 === 3 ? '감정 퇴사 욕구나 충동 결제가 올라옵니다. 새벽 결정은 특히 피하세요.' : '사람 정리가 강하게 들어옵니다. 떠나는 사람을 붙잡기보다 반복 패턴을 보세요.'}`,
    getMonthlyMoneyLine(item.score),
    getMonthlyLoveLine(month, item.score),
    `인간관계: 말로는 괜찮다 해놓고 속으로 거리 두는 장면을 조심하세요. 누가 내 시간을 반복해서 쓰게 만드는지 보면 정리할 사람이 보입니다.`,
    getMonthlyHealthLine(item.score),
    `행동 팁: ${action} 이번 달에는 ${report.helpfulElements.join(', ')} 흐름과 맞는 생활 기준 하나를 골라 7일 동안만 유지하세요.`,
    `피해야 할 행동: 감정이 올라온 상태에서 결제, 이직, 이별, 동업을 결정하지 마세요.`,
    `중요한 포인트: 이 달의 핵심은 “좋아 보이는 선택”이 아니라 내 돈, 연락, 약속, 수면을 망가뜨리지 않는 선택입니다.`
  ].join('\n\n');
}

function buildYearlyFortuneReportV2(report: SajuReportData): SajuReportData {
  const targetYear = report.monthLuck[0]?.year || report.yearLuck[0]?.year || new Date().getFullYear();
  const currentYear = report.yearLuck.find((item) => item.year === targetYear) || report.yearLuck[0];
  const bestMonths = [...report.monthLuck].sort((left, right) => right.score - left.score).slice(0, 3);
  const watchMonths = [...report.monthLuck].sort((left, right) => left.score - right.score).slice(0, 3);
  const helpfulText = formatElementList(report.helpfulElements) || '보완 오행';
  const cautiousText = formatElementList(report.cautiousElements) || '주의 오행';
  const openingMetaphor = getYearlyOpeningMetaphor(currentYear?.score);
  const bestMonthText = bestMonths.map((item) => `${item.month}월`).join(', ');
  const watchMonthText = watchMonths.map((item) => `${item.month}월`).join(', ');
  const elementRealityLine = buildYearlyElementRealityLine(report, currentYear);
  const strengthReadingLine = buildYearlyStrengthReading(report);

  const openingSection: ReportSection = {
    id: 'yearly-opening',
    title: `${targetYear}년 신년운세 오프닝`,
    subtitle: '올해 전체 기운을 한 장면으로 먼저 잡습니다.',
    callout: {
      title: `${targetYear}년 한 줄 판정`,
      body: currentYear
        ? `${currentYear.headline}. ${openingMetaphor}`
        : openingMetaphor
    },
    paragraphs: [
      `${report.customerName}님에게 ${targetYear}년은 버티는 해가 아니라 덜어내야 열리는 해입니다. 오래 붙잡은 관계, 애매한 돈 약속, 끝이 흐린 일을 계속 들고 있으면 좋은 제안이 와도 손이 비어 있지 않습니다.`,
      `올해 버려야 할 것은 “내가 아니면 안 된다”는 책임 과다입니다. 혼자 떠안고 피곤해진 뒤 갑자기 연락을 끊는 방식은 사람도 돈도 멀어지게 만듭니다.`,
      `올해 잡아야 할 것은 가격, 약속, 일정, 역할의 선명함입니다. ${withTopicParticle(`${helpfulText} 기운`)} 살아날수록 돈은 한 방보다 반복에서 붙고, 사람은 말보다 책임을 지키는 쪽으로 남습니다.`
    ],
    cards: [
      {
        title: '올해 버릴 것',
        body: '애매한 부탁, 끝없는 설명, 돈 이야기를 흐리는 관계, 피곤한데도 괜찮은 척하는 습관을 버려야 합니다.',
        tone: 'warn'
      },
      {
        title: '올해 잡을 것',
        body: '정산일, 제공 범위, 만나는 기준, 수면 시간을 먼저 잡으세요. 올해 운은 감정보다 생활의 고정값에 붙습니다.',
        tone: 'good'
      },
      {
        title: '캡처 한 줄',
        body: '올해는 사람을 많이 만나는 해가 아니라, 돈과 시간을 흐리는 사람을 걸러내는 해입니다.',
        badge: 'SAVE'
      }
    ]
  };

  const natalCoreSection: ReportSection = {
    id: 'yearly-natal-core',
    title: '사주 원국 핵심 분석',
    subtitle: '올해 운을 보기 전에 “내가 왜 이렇게 반복하는지”를 먼저 잡습니다.',
    paragraphs: [
      `${report.dayMaster} 일간은 겉으로는 담담해 보여도 안쪽에는 기준이 강합니다. 남 눈치 안 보는 척하지만 실제로는 평가, 약속, 결과물의 완성도에 예민하게 반응합니다.`,
      elementRealityLine,
      strengthReadingLine
    ],
    cards: [
      {
        title: '일간 성향',
        body: `${report.dayMaster} 일간은 기준을 세우고 버티는 힘이 있습니다. 다만 기준이 흐린 사람과 일하면 피로가 빨리 쌓입니다.`,
        tone: 'good'
      },
      {
        title: '신강·신약',
        body: strengthReadingLine
      },
      {
        title: '용신·희신',
        body: `${helpfulText} 기운이 올해의 보완축입니다. 이 기운은 색깔 놀이가 아니라 수면, 돈 기록, 약속 기준, 공간 정리로 써야 효과가 납니다.`,
        tone: 'good'
      },
      {
        title: '반복 실패 패턴',
        body: '좋은 사람이라 믿고 범위를 열어주다가, 나중에 돈·시간·책임이 섞이면 갑자기 마음이 식습니다.',
        tone: 'warn'
      },
      {
        title: '인간관계 특징',
        body: '처음엔 잘 받아주지만 상대가 계속 기대면 피로를 숨깁니다. 그러다 어느 날 답장이 짧아지고 마음속에서는 이미 정리합니다.'
      },
      {
        title: '돈 들어오는 방식',
        body: '한 방형보다 누적형입니다. 신뢰가 쌓인 사람, 반복 고객, 소개와 재구매에서 돈이 붙습니다.',
        tone: 'good'
      },
      {
        title: '스트레스 구조',
        body: `${cautiousText} 기운이 과하게 건드려질 때 말투가 차가워지고 잠이 밀립니다. 몸이 무너지면 운도 같이 좁아집니다.`,
        tone: 'warn'
      },
      {
        title: '캡처 한 줄',
        body: '이 사주는 사람보다 구조를 믿을 때 돈이 붙습니다.',
        badge: 'SAVE'
      }
    ]
  };

  const yearlyMapSection: ReportSection = {
    id: 'yearly-map',
    title: `${targetYear}년 전체 운세 지도`,
    subtitle: '대운과 세운이 만나는 지점을 돈, 사람, 이동, 문서, 정리운으로 나눠 봅니다.',
    callout: {
      title: '올해 핵심 시기',
      body: `${bestMonthText || '강한 달'}에는 공개, 제안, 계약, 만남을 열고, ${watchMonthText || '약한 달'}에는 정산, 관계 정리, 수면 회복을 우선해야 합니다.`
    },
    paragraphs: [
      `${targetYear}년 세운은 현재 ${report.currentDayun.name} 대운과 만나 선택지를 늘립니다. 선택지가 늘어난다는 건 좋은 일만 많아진다는 뜻이 아니라, 돈을 쓰게 만드는 사람과 돈을 벌게 만드는 사람이 동시에 들어온다는 뜻입니다.`,
      `문서운은 계약서, 가격표, 신청서, 포트폴리오처럼 “눈에 보이는 증거”로 살아납니다. 말로만 정한 약속은 올해 손실로 바뀌기 쉽습니다.`,
      `인간관계 정리운도 같이 있습니다. 멀어지는 사람을 억지로 붙잡지 말고, 반복해서 내 일정과 돈을 흐리게 만드는 사람부터 조용히 거리를 두세요.`
    ],
    cards: [
      {
        title: '변화수',
        body: '멈춰 있던 일과 연락이 다시 움직입니다. 이동, 제안, 상품 수정, 역할 변경이 들어오면 무조건 거절하지 말고 조건부터 보세요.',
        tone: 'good'
      },
      {
        title: '귀인운',
        body: '귀인은 갑자기 구해주는 사람이 아니라 내 기준을 알아보고 다시 맡기는 사람입니다. 꾸준히 본 사람, 약속을 지키는 고객, 조용한 소개가 귀인입니다.'
      },
      {
        title: '이동수',
        body: '장소 이동, 일의 포지션 이동, 고객층 이동이 생길 수 있습니다. 다만 불안해서 도망치듯 옮기면 같은 문제가 따라옵니다.',
        tone: 'warn'
      },
      {
        title: '문서운',
        body: '계약, 신청, 가격표, 안내문, 포트폴리오가 돈으로 바뀝니다. 올해는 말 잘하는 사람보다 문서가 남는 사람이 이깁니다.',
        tone: 'good'
      },
      {
        title: '터지는 시기',
        body: bestMonths[0]
          ? `${bestMonths[0].month}월 전후에는 공개와 제안이 좋습니다. 반대로 ${watchMonths[0]?.month || '약한'}월 전후에는 감정적 결정을 피하세요.`
          : '강한 달에는 밖으로 꺼내고, 약한 달에는 안쪽을 고치는 방식이 좋습니다.'
      },
      {
        title: '캡처 한 줄',
        body: '올해 풀리는 사람은 운이 좋은 사람이 아니라, 약속과 돈을 흐리지 않는 사람입니다.',
        badge: 'SAVE'
      }
    ]
  };

  const monthlySection: ReportSection = {
    id: 'month',
    title: `${targetYear}년 월별 운세`,
    subtitle: '총운, 돈, 연애, 인간관계, 건강, 행동 팁과 피해야 할 행동까지 월별로 봅니다.',
    details: report.monthLuck.map((item, index) => ({
      summary: `${item.year}.${String(item.month).padStart(2, '0')} · ${getLuckPhase(item.score)} · ${getMonthBehaviorTheme(item.month)}`,
      content: buildYearlyMonthlyDetail(item, report),
      open: index === 0
    }))
  };

  const moneySection: ReportSection = {
    id: 'yearly-money',
    title: '재물운',
    subtitle: '돈이 들어오는 방식, 새는 패턴, 투자 성향, 사업/직장 궁합을 현실적으로 봅니다.',
    paragraphs: [
      `${report.customerName}님은 “한 방형”보다 “누적형” 재물 구조입니다. 신뢰를 쌓고, 다시 맡기고, 소개가 이어지는 구조에서 돈이 남습니다.`,
      `돈이 새는 장면은 늘 비슷합니다. 가까운 사람이라 거절하지 못하고, 가격을 흐리고, 제공 범위를 넓혀주다가 나중에 혼자 피로와 비용을 떠안습니다.`,
      `투자는 빠른 수익보다 기록과 검증이 먼저입니다. 감정이 올라온 날, 누가 급하게 권한 투자, 이해하지 못한 상품은 올해 특히 피해야 합니다.`
    ],
    cards: [
      {
        title: '돈 들어오는 방식',
        body: '반복 고객, 소개, 신뢰 기반 상품, 다시 확인할 수 있는 결과물에서 돈이 들어옵니다. 사람 운이 돈으로 바뀌는 사주입니다.',
        tone: 'good'
      },
      {
        title: '망하는 투자 스타일',
        body: '남들이 벌었다는 말에 늦게 들어가고, 손실을 인정하기 싫어서 오래 들고 가는 방식은 맞지 않습니다.',
        tone: 'warn'
      },
      {
        title: '사업 vs 직장',
        body: '직장에서는 기준을 세우는 역할, 사업에서는 진단·상담·리포트·교육형 상품이 유리합니다. 감정형 동업은 금물입니다.'
      },
      {
        title: '상승 시기',
        body: `${bestMonthText || '강한 달'}에는 가격 공개, 상품 출시, 제안서 발송이 좋습니다. 돈은 열린 달에 벌고 약한 달에 지켜야 남습니다.`,
        tone: 'good'
      },
      {
        title: '캡처 한 줄',
        body: '당신은 한 방형이 아니라 누적형 재물 구조입니다.',
        badge: 'SAVE'
      }
    ]
  };

  const riskSection: ReportSection = {
    id: 'yearly-risk',
    title: '올해 가장 위험한 선택',
    subtitle: '망하는 선택은 늘 멋있게 보이고, 손실은 나중에 조용히 옵니다.',
    callout: {
      title: '올해 위험 신호',
      body: '감정이 올라온 밤에 내린 결정은 올해 가장 비쌉니다. 퇴사, 투자, 연애, 동업, 큰 결제는 다음 날 오전에 다시 봐야 합니다.'
    },
    cards: [
      {
        title: '감정 퇴사',
        body: '참다가 폭발해서 “나 그만둘래”가 올라옵니다. 문제는 회사를 나가는 게 아니라, 밖에서 팔 결과물 없이 나가는 것입니다. 퇴사는 포트폴리오와 현금 계획이 있을 때 선택입니다.',
        tone: 'warn'
      },
      {
        title: '급한 투자',
        body: '누가 “이번 기회 놓치면 안 돼”라고 말할 때 가장 조심해야 합니다. 이해하지 못한 돈은 내 돈이 아니라 남의 말에 맡긴 돈입니다.',
        tone: 'warn'
      },
      {
        title: '외로울 때 시작한 연애',
        body: '외로운 밤에 오는 연락은 따뜻해 보입니다. 하지만 약속, 현재 관계 상태, 돈 쓰는 태도를 확인하지 않으면 같은 불안이 반복됩니다.',
        tone: 'warn'
      },
      {
        title: '말뿐인 동업',
        body: '친하니까 괜찮다는 말이 제일 위험합니다. 역할, 정산일, 수정 횟수, 책임 범위를 적지 않으면 관계와 돈이 같이 상합니다.',
        tone: 'warn'
      },
      {
        title: '새벽 결정',
        body: '새벽에는 판단보다 감정이 큽니다. 결제, 장문 연락, 이별 통보, 투자 클릭은 아침 10시 이후로 미루세요.',
        tone: 'warn'
      },
      {
        title: '돈 흐린 관계',
        body: '“이번만 도와줘”가 반복되는 관계는 운이 아니라 지출입니다. 좋은 사람 되려다 내 일정과 체력이 계속 빠져나갑니다.',
        tone: 'warn'
      }
    ]
  };

  const opportunitySection: ReportSection = {
    id: 'yearly-opportunity',
    title: '올해 가장 강한 기회',
    subtitle: '기회는 크게 오는 게 아니라, 반복 가능한 결과물로 바뀔 때 커집니다.',
    paragraphs: [
      `${bestMonthText || '점수가 높은 달'}에는 공개, 제안, 소개, 재구매가 열립니다. 이때 해야 할 일은 감으로 밀어붙이는 것이 아니라 가격표와 샘플 결과물을 먼저 보여주는 것입니다.`,
      `올해 강한 기회는 말이 많은 사람보다 실행이 빠른 사람과 연결됩니다. 연락 텀이 일정하고, 돈 이야기를 피하지 않고, 약속을 바로 캘린더에 넣는 사람이 귀인입니다.`,
      `기회가 왔을 때 바로 잡으려 하지 말고 “제공 범위, 마감일, 정산일, 수정 횟수” 네 가지를 확인하세요. 이 네 가지가 정리되면 운이 실제 돈으로 바뀝니다.`
    ],
    cards: [
      {
        title: '언제 열리는가',
        body: `${bestMonthText || '강한 달'}에는 사람과 제안이 늘어납니다. 이때는 숨지 말고 샘플, 소개문, 가격표를 꺼내야 합니다.`,
        tone: 'good'
      },
      {
        title: '해야 할 행동',
        body: '대표 상품 하나를 정하고, 결과 예시를 보여주고, 문의가 오면 가격표를 먼저 보내세요. 설명이 길어질수록 돈은 흐려집니다.',
        tone: 'good'
      },
      {
        title: '연결되는 사람',
        body: '일정 정확한 사람, 실행 빠른 사람, 돈 이야기를 피하지 않는 사람, 내 시간을 존중하는 사람이 올해의 기회입니다.',
        tone: 'good'
      },
      {
        title: '캡처 한 줄',
        body: '올해 기회는 운 좋게 오는 게 아니라, 준비된 가격표를 보고 들어옵니다.',
        badge: 'SAVE'
      }
    ]
  };

  const peopleTypeSection: ReportSection = {
    id: 'yearly-people-type',
    title: '올해 귀인과 손실 부르는 사람',
    subtitle: '사람을 많이 만나는 것보다 누구를 남길지 고르는 해입니다.',
    cards: [
      {
        title: '올해 귀인 타입',
        body: '말보다 실행이 빠른 사람, 일정이 정확한 사람, 연락 텀이 일정한 사람, 돈 이야기를 피하지 않는 사람입니다. 이 사람들은 큰말을 안 해도 결과를 남깁니다.',
        tone: 'good'
      },
      {
        title: '돈으로 이어지는 사람',
        body: '내 결과물을 보고 다시 맡기거나 소개해 주는 사람입니다. 감정적으로 친한 사람보다 역할과 기대치가 분명한 사람이 돈을 가져옵니다.',
        tone: 'good'
      },
      {
        title: '손실 부르는 사람',
        body: '급하게 친해지는 사람, 피해자 말투가 많은 사람, 계속 “이번만” 하는 사람, 말은 좋은데 실행이 없는 사람입니다. 처음엔 정이 가지만 결국 내 시간과 체력을 가져갑니다.',
        tone: 'warn'
      },
      {
        title: '관계 정리 기준',
        body: '세 번 이상 같은 부탁을 하고, 돈과 시간을 흐리고, 미안하다는 말 뒤에 행동이 안 바뀌면 거리를 둬야 합니다.',
        tone: 'warn'
      },
      {
        title: '캡처 한 줄',
        body: '올해 사람은 호감이 아니라 약속 이행으로 걸러야 합니다.',
        badge: 'SAVE'
      }
    ]
  };

  const loveSection: ReportSection = {
    id: 'yearly-love',
    title: '연애운',
    subtitle: '들어오는 사람, 시작 시기, 끊어야 할 유형, 재회와 결혼 포인트를 봅니다.',
    paragraphs: [
      `${targetYear}년 연애운은 강하게 끌리는 사람보다 생활이 무너지지 않는 사람을 골라야 열립니다. 처음부터 뜨거운 사람은 마음을 흔들지만, 오래 가는 사람은 약속과 말투가 일정합니다.`,
      `들어오는 사람은 직업을 하나로 못 박기보다 일정 관리가 분명하고 자기 일이 있는 사람 쪽입니다. 외모는 화려함보다 단정함, 말투는 빠른 고백보다 꾸준한 확인으로 읽힙니다.`,
      `재회운은 감정만 남아 있는지, 다시 생활을 맞출 수 있는지로 갈립니다. 전 연인 연락수가 강한 달에도 과거의 문제를 말로만 덮으면 같은 지점에서 다시 깨집니다.`
    ],
    cards: [
      {
        title: '연애 시작 시기',
        body: bestMonths[1]
          ? `${bestMonths[1].month}월 전후는 만남을 열기 좋습니다. 소개, 반복적으로 보는 자리, 일과 연결된 모임을 가볍게 열어보세요.`
          : '강한 달에는 소개와 만남을 열고, 약한 달에는 관계 기준을 정리하세요.',
        tone: 'good'
      },
      {
        title: '끊어야 할 유형',
        body: '말은 뜨거운데 약속이 자주 바뀌는 사람, 돈 이야기를 흐리는 사람, 전 연인과 경계가 애매한 사람은 피해야 합니다.',
        tone: 'warn'
      },
      {
        title: '바람·삼각관계 위험',
        body: '감정 공백이 길어질 때 외부 자극에 흔들릴 수 있습니다. 외로울 때 시작한 관계는 반드시 상대의 현재 관계 상태부터 확인하세요.',
        tone: 'warn'
      },
      {
        title: '결혼운',
        body: '결혼은 설렘보다 생활 기준입니다. 돈, 가족 거리, 수면, 일의 우선순위가 맞는 사람이 오래 갑니다.'
      },
      {
        title: '캡처 한 줄',
        body: '좋아하는데도 표현이 늦어서 관계를 놓치는 타입입니다.',
        badge: 'SAVE'
      }
    ]
  };

  const careerSection: ReportSection = {
    id: 'yearly-career',
    title: '직업운',
    subtitle: '이직, 승진, 창업, 공부, 프리랜서 적성과 하면 안 되는 방식을 봅니다.',
    paragraphs: [
      `${targetYear}년 직업운은 “어디로 갈까”보다 “내 능력을 어떤 결과물로 보이게 만들까”가 핵심입니다. 이력, 포트폴리오, 가격표, 샘플 결과물이 운을 받는 그릇입니다.`,
      `이직운은 감정으로 퇴사하면 흔들립니다. 지금 직장이 싫어서 나가는 방식보다, 밖에서 팔릴 결과물을 만든 뒤 옮겨야 손실이 줄어듭니다.`,
      `프리랜서와 1인 사업은 맞지만, 혼자 다 떠안는 방식은 맞지 않습니다. 상담, 제작, 결제, 고객 응대, 수정 범위를 나눠야 오래 갑니다.`
    ],
    cards: [
      {
        title: '승진·평가운',
        body: '말보다 결과물이 남아야 평가가 붙습니다. 회의에서 잘 보이는 것보다 누가 봐도 남는 문서와 지표가 필요합니다.',
        tone: 'good'
      },
      {
        title: '창업운',
        body: 'SNS 기반 부업, 리포트형 상품, 상담형 콘텐츠, 교육·가이드 상품이 유리합니다. 올해 동업은 역할과 정산을 먼저 적어야 합니다.'
      },
      {
        title: '공부·시험운',
        body: '새로운 공부보다 바로 상품이나 업무에 붙는 공부가 맞습니다. 자격증도 “어디에 팔 것인지”가 있어야 힘이 납니다.'
      },
      {
        title: '하면 안 되는 방식',
        body: '감정으로 퇴사, 준비 없는 창업, 말뿐인 동업, 가격 없는 서비스 시작은 금물입니다.',
        tone: 'warn'
      },
      {
        title: '캡처 한 줄',
        body: '올해 일운은 능력보다 결과물을 보이게 만드는 사람이 이깁니다.',
        badge: 'SAVE'
      }
    ]
  };

  const relationshipSection: ReportSection = {
    id: 'yearly-relationship',
    title: '인간관계 운',
    subtitle: '귀인, 손절해야 할 관계, 가족·친구·직장 관계와 배신수를 봅니다.',
    paragraphs: [
      `올해 인간관계는 넓어지는 동시에 정리됩니다. 새로 들어오는 사람도 있지만, 예전처럼 다 받아주면 같은 피로가 반복됩니다.`,
      `귀인은 화려하게 나타나는 사람이 아니라 약속을 지키고, 내 시간을 함부로 쓰지 않고, 돈과 역할을 분명히 하는 사람입니다.`,
      `배신수는 누군가가 갑자기 나를 해친다는 뜻보다, 내가 흐린 약속을 방치했을 때 손실로 드러나는 장면에 가깝습니다.`
    ],
    cards: [
      {
        title: '귀인 들어오는 시기',
        body: `${bestMonthText || '강한 달'}에는 소개, 협업, 재구매가 열립니다. 이미 신뢰가 있던 사람에게 먼저 제안하세요.`,
        tone: 'good'
      },
      {
        title: '손절해야 하는 관계',
        body: '내 일정은 당연히 쓰면서 자기 책임은 흐리는 사람, 돈 이야기를 피하는 사람, 내 피로를 모르는 사람입니다.',
        tone: 'warn'
      },
      {
        title: '가족·친구 문제',
        body: '가까운 사람일수록 더 분명해야 합니다. 가족과 친구에게도 돈, 시간, 부탁의 범위를 말로만 두지 마세요.'
      },
      {
        title: '직장 인간관계',
        body: '상사보다 애매한 동료 부탁이 피로를 만듭니다. 좋은 사람으로 보이려다가 업무 범위가 늘어나는 장면을 조심하세요.'
      },
      {
        title: '캡처 한 줄',
        body: '혼자 버티는 시간이 길수록 인간관계를 정리해버립니다.',
        badge: 'SAVE'
      }
    ]
  };

  const healthSection: ReportSection = {
    id: 'yearly-health',
    title: '건강운',
    subtitle: '공포가 아니라 수면, 스트레스, 과로 위험 달을 생활관리로 봅니다.',
    paragraphs: [
      `건강운은 질병 예언이 아니라 몸이 언제 운을 못 받는 그릇이 되는지를 보는 파트입니다. ${cautiousText} 기운이 건드려질 때 수면, 소화, 어깨·목, 눈 피로가 먼저 흔들릴 수 있습니다.`,
      `올해 가장 조심할 것은 과로입니다. 일이 풀릴수록 잠을 줄이면 판단이 흐려지고, 말투가 차가워지고, 관계가 먼저 상합니다.`,
      `야식과 새벽 생활은 운을 직접 흔듭니다. 몸이 무거운 날에는 중요한 결정을 미루는 게 맞습니다.`
    ],
    cards: [
      {
        title: '약한 부위',
        body: '스트레스가 몸으로 내려오면 소화, 어깨·목, 눈 피로, 수면 질로 먼저 나타납니다. 증상이 있으면 의료 전문가 상담이 우선입니다.'
      },
      {
        title: '과로 위험 달',
        body: `${watchMonthText || '낮은 점수의 달'}에는 약속을 줄이고 회복 시간을 먼저 넣으세요. 운이 약한 달은 쉬어야 다음 달을 받습니다.`,
        tone: 'warn'
      },
      {
        title: '해결책',
        body: '물 섭취, 아침 햇빛, 수면 시간 고정, 야식 줄이기. 이 네 가지가 올해 개운법보다 먼저입니다.',
        tone: 'good'
      },
      {
        title: '캡처 한 줄',
        body: '새벽 생활을 줄이면 운보다 먼저 말투가 부드러워집니다.',
        badge: 'SAVE'
      }
    ]
  };

  const luckActionSection: ReportSection = {
    id: 'yearly-luck-action',
    title: '개운법',
    subtitle: '추상적인 조언이 아니라 오늘 바로 바꿀 수 있는 생활 가이드입니다.',
    cards: [
      {
        title: '행운 색',
        body: `${report.helpfulElements.includes('화') ? '따뜻한 아이보리, 코랄, 브릭 계열' : report.helpfulElements.includes('수') ? '네이비, 블랙, 차분한 블루 계열' : report.helpfulElements.includes('목') ? '그린, 올리브, 우드톤' : report.helpfulElements.includes('금') ? '화이트, 실버, 그레이' : '베이지, 브라운, 샌드톤'}을 가까이 두세요. 과한 포인트보다 자주 보는 물건에 쓰는 것이 좋습니다.`,
        tone: 'good'
      },
      {
        title: '피해야 하는 색',
        body: `${report.cautiousElements.includes('화') ? '강한 레드와 과한 네온톤' : report.cautiousElements.includes('수') ? '무거운 블랙 일색' : report.cautiousElements.includes('목') ? '복잡한 초록 패턴' : report.cautiousElements.includes('금') ? '차가운 메탈 과다' : '무거운 흙색 과다'}은 피로할 때 더 답답하게 느껴질 수 있습니다.`,
        tone: 'warn'
      },
      {
        title: '숫자와 방향',
        body: '중요한 일은 오전 7~11시 사이에 시작하세요. 방향은 책상 기준 남동쪽을 밝게 두고, 자주 쓰는 서류는 오른쪽 위에 모으세요.'
      },
      {
        title: '음식과 향',
        body: '따뜻한 물, 담백한 단백질, 너무 늦지 않은 저녁이 좋습니다. 향은 우디, 시트러스, 백단처럼 머리를 맑게 하는 계열이 맞습니다.'
      },
      {
        title: '지갑과 인테리어',
        body: '지갑은 낡은 영수증을 비우고, 침구는 너무 어두운 색보다 깨끗한 밝은 톤이 좋습니다. 남서 방향 조명을 밝게 두세요.'
      },
      {
        title: '잘 맞는 사람 오행',
        body: `${helpfulText} 기운을 가진 사람처럼 일정이 분명하고 말보다 행동이 반복되는 사람이 올해 귀인입니다. 말 많은 사람보다 약속 지키는 사람을 보세요.`
      },
      {
        title: '운 좋아지는 루틴',
        body: '아침 햇빛 10분, 지출 기록 3줄, 자기 전 휴대폰 20분 줄이기. 이 세 가지가 올해 가장 현실적인 개운법입니다.',
        tone: 'good'
      }
    ]
  };

  const closingSection: ReportSection = {
    id: 'yearly-closing',
    title: '마지막 총정리',
    subtitle: '올해를 어떻게 잡아야 다음 3년이 열리는지 정리합니다.',
    callout: {
      title: '올해의 결론',
      body: `${targetYear}년은 버티는 해가 아닙니다. 정리할 것을 정리해야 다음 3년이 열립니다. 사람 하나, 선택 하나가 인생의 돈과 일정을 완전히 바꿀 수 있습니다.`
    },
    paragraphs: [
      `올해 가장 위험한 것은 운이 없는 게 아니라, 좋은 기회와 피곤한 부탁을 구분하지 못하는 것입니다.`,
      `돈은 반복에서 붙고, 사람은 약속에서 남고, 일은 결과물에서 커집니다. ${report.customerName}님은 이 세 가지를 잡을 때 올해가 살아납니다.`,
      `마지막 기준은 단순합니다. 내 수면, 돈, 연락, 책임을 망가뜨리는 선택이면 아무리 좋아 보여도 올해의 길이 아닙니다.`
    ]
  };

  return {
    ...report,
    heroNote: `${targetYear}년은 ${report.customerName}님에게 돈, 연락, 약속, 책임을 다시 고정하는 해입니다. 좋은 운을 기다리는 것보다 손에 남는 구조를 만드는 사람이 이깁니다.`,
    summary: {
      title: `${targetYear}년 신년운세 핵심 판정`,
      analysis: [
        openingMetaphor,
        `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 같이 보면 올해는 넓히기보다 걸러내고, 감으로 버티기보다 가격·역할·일정을 고정해야 하는 해입니다.`,
        `올해 버릴 것은 애매한 관계, 돈 이야기를 흐리는 약속, 내 체력을 갈아 넣는 책임입니다.`,
        `올해 잡아야 할 것은 ${helpfulText} 흐름을 현실에서 받아줄 생활 고정값입니다. 수면, 지출 기록, 상품 설명, 연락 기준을 잡으면 사람과 돈이 같이 붙습니다.`
      ],
      advice: [
        `${bestMonthText || '강한 달'}에는 공개, 제안, 만남을 열고 ${watchMonthText || '약한 달'}에는 정산과 회복을 우선하세요.`,
        '올해는 감정으로 퇴사, 이별, 동업, 큰 결제를 결정하지 마세요. 하루 뒤 다시 봐야 손실이 줄어듭니다.',
        '돈은 가격표에서 지키고, 관계는 약속에서 지키고, 건강은 수면에서 지키세요.'
      ]
    },
    keyTakeaways: [
      {
        title: '올해 한 줄',
        body: currentYear?.headline || '정리할 것을 정리해야 다음 판이 열리는 해입니다.',
        tone: 'good'
      },
      {
        title: '버릴 것',
        body: '애매한 부탁, 말뿐인 약속, 경계 없는 돈 관계, 피곤한데 괜찮은 척하는 습관입니다.',
        tone: 'warn'
      },
      {
        title: '잡을 것',
        body: '가격표, 정산일, 연락 기준, 수면 시간, 반복 가능한 결과물입니다.',
        tone: 'good'
      },
      {
        title: '돈',
        body: '한 방보다 누적입니다. 사람 운이 돈으로 바뀌려면 역할과 범위가 분명해야 합니다.'
      },
      {
        title: '관계',
        body: '올해 남길 사람은 말보다 약속을 지키는 사람입니다.'
      },
      {
        title: '건강',
        body: '새벽 생활을 줄이는 것이 가장 빠른 개운법입니다.',
        tone: 'warn'
      }
    ],
    sections: [
      openingSection,
      natalCoreSection,
      yearlyMapSection,
      monthlySection,
      riskSection,
      opportunitySection,
      peopleTypeSection,
      moneySection,
      loveSection,
      careerSection,
      relationshipSection,
      healthSection,
      luckActionSection,
      closingSection
    ],
    actionPlan: {
      ...report.actionPlan,
      title: `${targetYear}년 신년운세 실행 체크리스트`,
      priorities: [
        '1단계: 올해 끊을 관계, 줄일 지출, 버릴 일을 각각 하나씩 적습니다.',
        '2단계: 가격표, 정산일, 제공 범위, 연락 가능 시간을 고정합니다.',
        '3단계: 강한 달에는 공개와 제안을 열고, 약한 달에는 정산과 수면 회복을 먼저 합니다.',
        '4단계: 매달 말 돈, 연락, 약속, 수면이 무너진 장면을 기록하고 다음 달 행동을 줄입니다.'
      ],
      dos: [
        '중요한 약속은 메시지로 남기기',
        '지출 기록을 하루 3줄만 쓰기',
        '좋은 사람보다 약속 지키는 사람을 고르기',
        '아침 햇빛과 수면 시간을 먼저 고정하기'
      ],
      avoids: [
        '감정으로 퇴사, 이별, 동업 결정하기',
        '돈 이야기를 미루고 좋은 관계라고 믿기',
        '전 연인 연락에 바로 흔들리기',
        '과로한 밤에 큰 결제나 투자 결정하기'
      ]
    }
  };
}

function getFocusedBestMonthText(report: SajuReportData) {
  const bestMonths = [...report.monthLuck].sort((left, right) => right.score - left.score).slice(0, 3);

  return bestMonths
    .map((item) => `${item.year}.${String(item.month).padStart(2, '0')} ${getLuckPhase(item.score)}`)
    .join(', ');
}

function getFocusedWatchMonthText(report: SajuReportData) {
  const watchMonths = [...report.monthLuck].sort((left, right) => left.score - right.score).slice(0, 2);

  return watchMonths
    .map((item) => `${item.year}.${String(item.month).padStart(2, '0')} ${getLuckPhase(item.score)}`)
    .join(', ');
}

function buildFocusedMonthSection(report: SajuReportData, title: string, subtitle: string): ReportSection {
  return {
    id: 'focused-months',
    title,
    subtitle,
    details: report.monthLuck.slice(0, 8).map((item, index) => ({
      summary: getSignatureMonthSummary(item, report),
      content: buildSignatureMonthContent(item, report),
      open: index === 0
    }))
  };
}

type LoveOriginElementProfile = {
  label: string;
  match: string;
  person: string;
  why: string;
  places: string;
  together: string;
  danger: string;
  capture: string;
};

const LOVE_ORIGIN_ELEMENT_PROFILES: Record<string, LoveOriginElementProfile> = {
  목: {
    label: '목(木)',
    match: '甲·乙 일간이거나 일지·월지에 寅·卯가 살아 있는 사람',
    person: '말을 예쁘게 하는 사람보다 “다음 단계를 같이 키우는 사람”입니다. 배움, 성장, 계획, 자기관리의 결이 있습니다.',
    why: '관계가 애매하게 멈추지 않습니다. 같이 배우고 고치고 넓히는 힘이 생겨서, 좋아하는 마음이 실제 미래 계획으로 이어집니다.',
    places: '강의, 스터디, 독서모임, 브랜딩·기획 세미나, 러닝·등산 모임, 식물이 있는 카페나 조용한 작업 공간에서 인연이 잘 열립니다.',
    together: '새로운 수업 듣기, 산책하며 다음 달 계획 세우기, 책 한 권을 같이 읽고 이야기하기, 가벼운 여행 동선 짜기가 좋습니다.',
    danger: '성장한다는 말만 많고 실제 생활은 바뀌지 않는 사람은 피해야 합니다. 꿈 이야기는 큰데 오늘의 행동이 없는 목 기운은 피로를 만듭니다.',
    capture: '이 연애는 같이 자라는 사람을 만나야 마음이 늦게 식습니다.'
  },
  화: {
    label: '화(火)',
    match: '丙·丁 일간이거나 일지·월지에 巳·午가 살아 있는 사람',
    person: '표현이 분명하고 표정이 살아 있는 사람입니다. 사랑을 숨기기보다 따뜻하게 보여주고, 분위기를 밝히는 힘이 있습니다.',
    why: '차가워진 판단과 늦은 표현을 데워줍니다. 혼자 생각만 하다 멈추는 장면을 줄이고, 마음을 말로 꺼내게 만듭니다.',
    places: '공연, 전시, 취미 클래스, 사진·영상 모임, 친구가 함께 있는 자리, SNS 콘텐츠나 뷰티·행사 관련 공간에서 접점이 생기기 쉽습니다.',
    together: '전시 보기, 맛집 탐방, 사진 찍기, 짧은 당일치기, 기념일을 작게 챙기는 데이트가 관계 온도를 살립니다.',
    danger: '초반 감정만 뜨겁고 생활 책임이 늦는 사람은 위험합니다. 불꽃은 큰데 다음 약속을 실제로 잡지 않는 사람은 오래 가지 않습니다.',
    capture: '따뜻한 사람은 설렘을 주고, 성숙한 사람은 그 설렘을 생활로 남깁니다.'
  },
  토: {
    label: '토(土)',
    match: '戊·己 일간이거나 일지·월지에 辰·戌·丑·未가 단단하게 있는 사람',
    person: '처음엔 느려 보여도 시간이 갈수록 믿음이 쌓이는 사람입니다. 말보다 생활, 지출, 책임감이 안정적으로 드러납니다.',
    why: '관계가 흔들릴 때 중심을 잡아줍니다. 감정이 오르내려도 일상 리듬을 같이 지키기 때문에 불안이 빨리 커지지 않습니다.',
    places: '지인 소개, 직장 근처, 동네 생활권, 운동센터, 요리·공방 클래스, 부동산·인테리어·식품처럼 생활 기반이 있는 공간이 좋습니다.',
    together: '정기적으로 밥 먹기, 장보기, 집 정리, 저축 목표 세우기, 주말 루틴 만들기처럼 평범한 일을 같이 할 때 애정이 깊어집니다.',
    danger: '고집만 세고 감정 표현이 너무 닫힌 사람은 답답합니다. 안정이라는 이름으로 변화를 거부하는 토 기운은 관계를 굳게 만듭니다.',
    capture: '이 사주는 화려한 사람보다 매일 같은 자리로 돌아오는 사람에게 마음이 놓입니다.'
  },
  금: {
    label: '금(金)',
    match: '庚·辛 일간이거나 일지·월지에 申·酉가 선명한 사람',
    person: '자기 기준이 있고 선을 지킬 줄 아는 사람입니다. 감정 표현은 담백해도 매너, 시간 감각, 일 처리에서 신뢰가 보입니다.',
    why: '흐린 관계를 분명하게 만들어줍니다. 서로의 영역을 침범하지 않고, 필요한 말은 짧게 해주기 때문에 관계 피로가 줄어듭니다.',
    places: '프로젝트, 협업, 직장 연결, 전문 모임, 금융·IT·디자인·컨설팅 행사, 소개를 통한 공식적인 자리에서 인연이 열리기 쉽습니다.',
    together: '전시 보기, 운동 기록 만들기, 일정 정리, 포트폴리오나 작업물 피드백, 깔끔한 식사 데이트가 잘 맞습니다.',
    danger: '기준은 있는데 배려가 없는 사람은 피해야 합니다. 맞는 말만 하고 마음을 돌보지 않는 금 기운은 상처를 남깁니다.',
    capture: '선을 지키는 사람을 만나야 사랑이 불안이 아니라 신뢰가 됩니다.'
  },
  수: {
    label: '수(水)',
    match: '壬·癸 일간이거나 일지·월지에 子·亥가 살아 있는 사람',
    person: '말수가 많지 않아도 생각이 깊고, 대화가 길어질수록 매력이 보이는 사람입니다. 정보, 글, 이동, 밤의 대화와 인연이 있습니다.',
    why: '속마음을 안전하게 꺼내게 만듭니다. 판단받는 느낌보다 이해받는 느낌이 커져서, 오래 숨긴 감정이 조금씩 풀립니다.',
    places: '온라인 커뮤니티, 글쓰기 모임, 스터디, 여행·이동 중 연결, 조용한 카페, 늦은 시간 대화가 이어지는 공간에서 접점이 생깁니다.',
    together: '밤 산책, 카페에서 깊은 대화, 짧은 여행 계획, 영화 보고 감상 나누기, 서로의 고민을 조용히 들어주는 시간이 좋습니다.',
    danger: '생각은 깊은데 결론을 계속 피하는 사람은 관계를 흐립니다. 침묵이 배려가 아니라 회피가 되는 수 기운은 불안을 키웁니다.',
    capture: '깊은 사람은 좋지만, 깊기만 하고 돌아오지 않는 사람은 붙잡지 마세요.'
  }
};

function getLoveOriginElementProfile(element?: string) {
  return LOVE_ORIGIN_ELEMENT_PROFILES[element || ''] || LOVE_ORIGIN_ELEMENT_PROFILES.토;
}

function buildLoveOriginMatchSection(report: SajuReportData): ReportSection {
  const dayPillar = parsePillar(report.pillars.day);
  const monthPillar = parsePillar(report.pillars.month);
  const hourPillar = parsePillar(report.pillars.hour);
  const primaryElement = report.helpfulElements[0] || report.dayMasterElement;
  const secondaryElement =
    report.helpfulElements.find((element) => element !== primaryElement) || dayPillar?.branchElement || report.dayMasterElement;
  const cautionElement = report.cautiousElements[0] || report.dayMasterElement;
  const primary = getLoveOriginElementProfile(primaryElement);
  const secondary = getLoveOriginElementProfile(secondaryElement);
  const caution = getLoveOriginElementProfile(cautionElement);
  const dayText = dayPillar
    ? `${dayPillar.stemHanja}${dayPillar.branchHanja} 일주, 일지 ${dayPillar.branchHanja}(${dayPillar.branchElement})`
    : `${report.pillars.day} 일주`;
  const monthText = monthPillar
    ? `${monthPillar.stemHanja}${monthPillar.branchHanja} 월령, 월지 ${monthPillar.branchHanja}(${monthPillar.branchElement})`
    : `${report.pillars.month} 월령`;
  const hourText = hourPillar
    ? `시주 ${hourPillar.stemHanja}${hourPillar.branchHanja}는 생활 리듬과 사적인 습관까지 보여줍니다.`
    : '출생 시간이 없거나 불명확하면 생활 리듬 궁합은 실제 만남에서 더 확인해야 합니다.';

  return {
    id: 'love-origin-match',
    title: '나와 맞는 사주 원국의 사람',
    subtitle: '일간 하나가 아니라 일지, 월지, 시주의 생활감까지 보고 인연상을 좁힙니다.',
    callout: {
      title: `${primary.label} 원국이 좋은 이유`,
      body: primary.capture
    },
    paragraphs: [
      `${report.customerName}님의 연애궁합은 ${dayText}와 ${monthText}을 같이 놓고 봐야 선명합니다. 일간은 내가 사랑을 받아들이는 방식이고, 일지는 가까운 관계에서 실제로 편한지 불편한지를 보여줍니다.`,
      `그래서 상대를 볼 때 “무슨 띠냐”보다 원국 안에 어떤 오행이 살아 있는지를 먼저 봅니다. ${report.customerName}님에게는 ${primary.label} 기운이 살아 있는 사람, 보조로 ${secondary.label} 감각이 있는 사람이 관계를 덜 불안하게 만듭니다.`,
      `${hourText} 연애가 오래 가려면 얼굴이나 직업보다 주말을 보내는 방식, 피곤할 때 말투, 돈을 쓰는 타이밍, 가족과 거리를 두는 방식이 맞아야 합니다.`
    ],
    cards: [
      {
        title: '만나야 할 원국',
        body: `${primary.match}. 여기에 ${secondary.match}의 결이 함께 있으면 설렘과 생활감이 같이 살아납니다.`,
        tone: 'good'
      },
      {
        title: '그 사람이 좋은 이유',
        body: primary.why
      },
      {
        title: '어디서 만날 수 있나',
        body: primary.places,
        tone: 'good'
      },
      {
        title: '같이 하면 좋은 것',
        body: primary.together
      },
      {
        title: '첫 만남에서 볼 장면',
        body: '대화가 잘 통하는지보다 헤어질 때 다음 일정을 어떻게 잡는지 보세요. 마음이 있는 사람은 분위기보다 다음 행동을 남깁니다.'
      },
      {
        title: '피해야 할 원국',
        body: `${caution.danger} 특히 ${caution.label} 기운이 과한데 자기 성찰이 없는 사람은 초반 끌림과 후반 피로가 같이 옵니다.`,
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '원국 궁합은 이 순서로 봅니다',
        content: `1. 일간: 상대가 사랑을 표현하는 기본 방식입니다.\n\n2. 일지: 둘이 가까워졌을 때 편한지, 피곤한지 보는 자리입니다.\n\n3. 월지: 사회생활, 일, 책임감, 평판 감각이 드러나는 자리입니다.\n\n4. 시주: 같이 살거나 자주 만났을 때 수면, 소비, 집안 습관, 사적인 리듬이 맞는지 보는 자리입니다.`,
        open: true
      },
      {
        summary: '현실에서 가장 잘 열리는 만남 루트',
        content: `${primary.places}\n\n두 번째 루트는 ${secondary.places} 조건입니다. 소개를 받는다면 “조건 좋은 사람”보다 이 공간에서 자연스럽게 반복해서 볼 수 있는 사람을 우선 보세요. 운이 맞는 인연은 한 번에 강하게 치고 들어오기보다, 같은 생활 반경에서 자주 눈에 들어옵니다.`
      },
      {
        summary: '관계를 오래 가게 만드는 데이트 방식',
        content: `${primary.together}\n\n이 데이트가 좋은 이유는 감정만 쓰지 않고 두 사람의 생활 호흡을 확인하게 해주기 때문입니다. 밥 한 번 먹고 끝나는 관계보다, 같이 움직이고 정리하고 다음 계획을 남기는 관계가 오래 갑니다.`
      }
    ]
  };
}

function hasTopTenGod(report: SajuReportData, labels: string[]) {
  return report.tenGods.slice(0, 4).some((item) => labels.some((label) => item.label.includes(label)));
}

function getLoveAffectionProfile(report: SajuReportData) {
  const profiles: Record<string, { speed: string; expression: string; skinship: string; caution: string; capture: string }> = {
    목: {
      speed: '마음이 열리면 천천히 가까워지지만, 관계가 성장한다는 느낌이 없으면 금방 힘이 빠집니다.',
      expression: '애정 표현은 말보다 챙김과 조언으로 나옵니다. 상대를 더 낫게 만들고 싶어 하는 방식입니다.',
      skinship: '스킨십은 분위기보다 신뢰가 먼저입니다. 갑자기 밀고 들어오는 사람보다 자연스럽게 거리를 좁히는 사람이 맞습니다.',
      caution: '상대가 내 조언을 간섭으로 받아들이면 서운함이 쌓입니다. 고치려 하기 전에 먼저 물어봐야 합니다.',
      capture: '이 사주는 몸보다 마음의 방향이 맞을 때 애정이 오래 갑니다.'
    },
    화: {
      speed: '처음 불이 붙으면 빠르게 가까워질 수 있습니다. 다만 뜨거운 시작일수록 현실 확인을 늦추면 후폭풍이 큽니다.',
      expression: '애정 표현은 눈빛, 말투, 리액션에서 티가 납니다. 좋아하면 분위기를 만들고 상대를 웃게 하려 합니다.',
      skinship: '스킨십은 감정 온도와 함께 올라갑니다. 다만 설렘이 강할수록 경계와 속도를 같이 확인해야 오래 갑니다.',
      caution: '상대가 표현을 줄이면 바로 식었다고 느낄 수 있습니다. 감정 확인을 몰아붙이면 상대가 숨을 곳을 찾습니다.',
      capture: '뜨거운 사람보다 뜨거운 마음을 오래 지키는 사람이 맞습니다.'
    },
    토: {
      speed: '연애 시작은 느린 편입니다. 대신 마음이 열리면 쉽게 흔들리지 않고, 생활 안으로 사람을 들입니다.',
      expression: '애정 표현은 밥, 시간, 이동, 챙김으로 나옵니다. 말보다 “내가 해줄게” 쪽에 가깝습니다.',
      skinship: '스킨십은 안정감이 생긴 뒤 깊어집니다. 몸의 거리보다 마음의 안전이 먼저 풀려야 합니다.',
      caution: '참다가 한 번에 닫는 흐름이 있습니다. 괜찮은 척 오래 하면 상대는 문제를 모른 채 지나갑니다.',
      capture: '이 사주는 편안해진 뒤에야 진짜 애정이 깊어집니다.'
    },
    금: {
      speed: '확신이 생기기 전에는 쉽게 다가가지 않습니다. 마음이 있어도 먼저 선을 확인하고 상대의 태도를 지켜봅니다.',
      expression: '애정 표현은 깔끔하고 담백합니다. 과한 말보다 약속을 지키고 불편한 일을 줄여주는 식입니다.',
      skinship: '스킨십은 선이 중요합니다. 예의와 동의가 분명한 사람에게 마음이 놓이고, 무례하게 빠른 사람에게는 바로 식습니다.',
      caution: '표현이 적어 차갑게 보일 수 있습니다. 마음이 있다면 짧은 말이라도 남겨야 상대가 버팁니다.',
      capture: '선을 지키는 애정이 이 사주의 마음을 가장 오래 붙잡습니다.'
    },
    수: {
      speed: '천천히 스며드는 연애입니다. 처음부터 뜨겁기보다 대화가 깊어지며 마음이 열립니다.',
      expression: '애정 표현은 긴 대화, 기억해주는 말, 조용한 배려로 나옵니다. 겉으로는 담담해도 속은 오래 움직입니다.',
      skinship: '스킨십은 정서적 안전감과 같이 움직입니다. 마음이 불안하면 몸도 닫히고, 믿음이 생기면 깊게 가까워집니다.',
      caution: '생각이 많아지면 혼자 해석하고 물러납니다. 확인하지 않은 상상이 관계를 늦게 갉아먹습니다.',
      capture: '이 사주는 몸의 거리보다 마음을 꺼내도 안전한지가 먼저입니다.'
    }
  };

  return profiles[report.dayMasterElement] || profiles.토;
}

function getLoveShadowProfile(report: SajuReportData) {
  if (hasTopTenGod(report, ['비견', '겁재'])) {
    return {
      jealousy: '질투가 나도 바로 티 내기보다 표정과 말수가 먼저 줄어듭니다. 상대가 눈치 못 채면 “말해봤자 뭐해”로 넘어가며 마음속 점수가 깎입니다.',
      obsession: '집착은 매달리는 방식보다 내 기준을 확인하려는 방식으로 나옵니다. 상대의 말과 행동이 맞는지 조용히 체크합니다.',
      avoidance: '자존심이 건드려지면 먼저 굽히기 어렵습니다. 싸우는 순간 끝내진 않아도 마음속에서는 관계 종료 준비가 시작됩니다.',
      test: '상대를 시험하려고 일부러 차갑게 구는 순간이 생길 수 있습니다. 이 테스트는 관계를 확인하는 게 아니라 상대를 지치게 만듭니다.'
    };
  }

  if (hasTopTenGod(report, ['식신', '상관'])) {
    return {
      jealousy: '질투가 올라오면 말투가 먼저 날카로워집니다. 농담처럼 던진 말에 진심이 섞이고, 상대는 갑자기 분위기가 바뀐다고 느낍니다.',
      obsession: '상대 반응을 계속 확인하고 싶어집니다. 답장이 짧으면 지난 대화까지 다시 읽으며 의미를 찾을 수 있습니다.',
      avoidance: '상처받은 뒤에는 설명을 길게 하다가 어느 순간 말 자체를 멈춥니다. 말로 풀던 사람이 침묵하면 이미 많이 지친 상태입니다.',
      test: '상대가 나를 얼마나 신경 쓰는지 보려고 일부러 답을 늦추거나 감정을 숨기는 장면을 조심해야 합니다.'
    };
  }

  if (hasTopTenGod(report, ['편재', '정재'])) {
    return {
      jealousy: '질투는 비교에서 시작됩니다. 상대가 누구에게 시간과 돈을 쓰는지 보면서 내 위치를 계산하게 됩니다.',
      obsession: '집착은 소유보다 확인 욕구에 가깝습니다. “나를 실제 우선순위에 두는가”를 소비, 일정, 이동에서 보려 합니다.',
      avoidance: '현실성이 없다고 느끼면 마음을 줄입니다. 좋아해도 미래 그림이 안 보이면 먼저 에너지를 빼기 시작합니다.',
      test: '상대가 나를 위해 어디까지 움직이는지 보려고 작은 부탁을 던질 수 있습니다. 반복되면 관계가 거래처럼 느껴집니다.'
    };
  }

  if (hasTopTenGod(report, ['편관', '정관'])) {
    return {
      jealousy: '질투가 나도 품위를 지키려 합니다. 겉으론 괜찮은 척하지만 속으로는 상대의 선 넘는 행동을 정확히 기록합니다.',
      obsession: '집착은 통제 욕구로 번질 수 있습니다. 관계가 불안하면 규칙, 확인, 약속을 더 강하게 요구하게 됩니다.',
      avoidance: '상대가 책임을 피하면 마음이 급격히 식습니다. 사과보다 이후 행동이 없으면 다시 믿기 어렵습니다.',
      test: '상대를 바로 몰아붙이기보다 책임지는 태도를 보는 시험이 생깁니다. 다만 말하지 않은 기준은 상대가 맞힐 수 없습니다.'
    };
  }

  return {
    jealousy: '질투가 나면 먼저 혼자 조용해집니다. 티를 내지 않으려 하지만, 속으로는 이미 여러 장면을 연결해 해석합니다.',
    obsession: '집착은 생각의 반복으로 나타납니다. 상대 말 한 줄을 오래 붙잡고, 밤에 같은 장면을 계속 되감습니다.',
    avoidance: '감정이 과해지면 설명보다 잠수를 택할 수 있습니다. 사라지고 싶은 게 아니라 더 말하면 무너질 것 같기 때문입니다.',
    test: '상대가 나를 알아서 이해해주길 바라며 말하지 않는 시험을 할 수 있습니다. 하지만 침묵은 사랑을 확인해주지 못합니다.'
  };
}

function buildLoveAffectionSection(report: SajuReportData): ReportSection {
  const profile = getLoveAffectionProfile(report);

  return {
    id: 'love-affection-skinship',
    title: '스킨십·애정표현 스타일',
    subtitle: '노골적인 예측이 아니라 가까워지는 속도, 표현 방식, 몸과 마음의 안전감을 봅니다.',
    callout: {
      title: '애정표현 핵심',
      body: profile.capture
    },
    paragraphs: [
      `${report.customerName}님의 연애는 스킨십 자체보다 “내가 이 사람 앞에서 긴장을 풀 수 있는가”가 먼저입니다. 마음이 안전하지 않으면 몸의 거리도 쉽게 가까워지지 않습니다.`,
      profile.speed,
      profile.skinship
    ],
    cards: [
      {
        title: '먼저 다가가는 방식',
        body: profile.expression,
        tone: 'good'
      },
      {
        title: '상대가 느끼는 나',
        body: '겉으로는 담담해 보여도 실제로는 상대의 말투, 시선, 손길의 속도를 세밀하게 봅니다. 그래서 무례하게 빠른 사람보다 기다릴 줄 아는 사람에게 마음이 열립니다.'
      },
      {
        title: '성적 긴장감이 생기는 순간',
        body: '외모만 강한 사람보다, 내 말을 기억하고 다음 행동으로 보여주는 사람에게 끌림이 깊어집니다. 신뢰가 쌓이면 애정의 온도도 같이 올라갑니다.'
      },
      {
        title: '주의점',
        body: profile.caution,
        tone: 'warn'
      }
    ]
  };
}

function buildLoveShadowSection(report: SajuReportData): ReportSection {
  const profile = getLoveShadowProfile(report);

  return {
    id: 'love-jealousy-avoidance',
    title: '질투·집착·회피 성향',
    subtitle: '좋은 말보다 실제 연애에서 문제를 만드는 그림자를 먼저 봅니다.',
    callout: {
      title: '팩폭 한 줄',
      body: '이 사주는 상처받으면 바로 싸우기보다 마음속에서 관계 종료 준비를 먼저 합니다.'
    },
    cards: [
      {
        title: '질투가 올라올 때',
        body: profile.jealousy,
        tone: 'warn'
      },
      {
        title: '집착이 생기는 방식',
        body: profile.obsession
      },
      {
        title: '회피와 잠수',
        body: profile.avoidance,
        tone: 'warn'
      },
      {
        title: '상대 테스트',
        body: profile.test,
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '망하는 장면을 실제로 풀면',
        content: `처음엔 이해합니다.\n\n두 번째도 넘깁니다.\n\n그런데 같은 일이 반복되면 말투가 짧아지고, 확인만 하고, 먼저 대화를 이어가려 하지 않습니다.\n\n상대는 “갑자기 왜 그래?”라고 느끼지만, ${report.customerName}님 마음속에서는 이미 몇 번의 경고가 지나간 뒤입니다.`,
        open: true
      },
      {
        summary: '바로 고쳐야 할 습관',
        content: '서운한 일을 끝까지 참았다가 한 번에 닫지 마세요. 작을 때 “이건 나는 불편해”라고 말해야 관계가 살아납니다. 침묵은 품위가 아니라 이별 예고가 될 수 있습니다.'
      }
    ]
  };
}

function buildLoveBreakupPatternSection(report: SajuReportData): ReportSection {
  const watchMonths = [...report.monthLuck].sort((left, right) => left.score - right.score).slice(0, 3);
  const watchText = watchMonths.map((item) => `${item.year}.${String(item.month).padStart(2, '0')}`).join(', ');

  return {
    id: 'love-breakup-pattern',
    title: '실제 이별 패턴',
    subtitle: '언제 헤어지는지가 아니라 어떤 장면에서 마음이 닫히는지를 봅니다.',
    callout: {
      title: '이별 신호',
      body: '말수가 줄고, 확인만 하고, 다음 약속을 먼저 잡지 않으면 이미 마음이 빠지고 있는 겁니다.'
    },
    paragraphs: [
      `${report.customerName}님은 싸우는 순간 바로 끝내는 타입이라기보다, 실망이 누적된 뒤 조용히 출구를 찾는 흐름이 강합니다.`,
      `헤어짐은 큰 사건 하나보다 작은 무시, 약속 변경, 답 없는 대화, 돈과 시간의 불균형이 반복될 때 시작됩니다.`,
      watchText ? `${watchText} 전후에는 감정 결론을 서두르지 말고, 하루 뒤 다시 판단하는 편이 좋습니다.` : '약한 월운에는 감정 결론을 서두르지 않는 편이 좋습니다.'
    ],
    details: [
      {
        summary: '마음이 식는 5단계',
        content: `1. 처음엔 상대의 사정을 이해합니다.\n\n2. 같은 문제가 반복되면 표정이 굳습니다.\n\n3. 연락을 봐도 바로 답하고 싶지 않습니다.\n\n4. 만남을 잡아도 기대보다 피로가 먼저 올라옵니다.\n\n5. 마지막에는 싸움보다 거리로 정리합니다.`,
        open: true
      },
      {
        summary: '붙잡아도 회복이 어려운 경우',
        content: '상대가 사과는 하는데 같은 행동을 반복할 때, 내 기준을 예민함으로 몰 때, 중요한 이야기를 계속 미룰 때입니다. 이 경우는 그리움보다 피로가 더 빨리 돌아옵니다.'
      },
      {
        summary: '살릴 수 있는 경우',
        content: '상대가 변명보다 행동을 바꾸고, 다음 만남에서 같은 실수를 줄이며, 내 불편함을 가볍게 넘기지 않을 때입니다. 말보다 다음 행동이 회복의 증거입니다.'
      }
    ]
  };
}

function getDohwaLoveText(report: SajuReportData) {
  const branches = getReportBranchPieces(report).map((piece) => piece.branch);

  if (branches.includes('유')) {
    return {
      title: '酉 도화 · 정돈된 매력',
      body: '처음엔 차가워 보일 수 있지만, 가까워질수록 깔끔함과 생활감에서 매력이 살아납니다. 과한 애교보다 정돈된 말투, 단정한 스타일, 약속을 지키는 태도가 이성을 끌어옵니다.',
      caution: '문제는 끌림보다 유지입니다. 상대가 흐리게 굴면 정이 빨리 떨어지고, 한번 식으면 다시 데우는 데 시간이 걸립니다.'
    };
  }

  if (branches.includes('자')) {
    return {
      title: '子 도화 · 조용한 흡인력',
      body: '말을 많이 하지 않아도 묘하게 시선이 가는 분위기가 있습니다. 밤의 대화, 메시지, 감정 공유에서 매력이 깊어집니다.',
      caution: '상대 말을 오래 해석하다 혼자 결론 내리면 관계가 늦게 닫힙니다. 확인하지 않은 상상은 줄여야 합니다.'
    };
  }

  if (branches.includes('오')) {
    return {
      title: '午 도화 · 밝은 존재감',
      body: '표정, 리액션, 분위기에서 매력이 드러납니다. 함께 있을 때 공간이 밝아지는 느낌이 이성을 끌어옵니다.',
      caution: '초반 설렘이 강한 만큼 현실 확인이 늦으면 실망도 큽니다. 뜨거운 말보다 반복되는 태도를 보세요.'
    };
  }

  if (branches.includes('묘')) {
    return {
      title: '卯 도화 · 부드러운 호감',
      body: '부드러운 말투, 배려, 자연스러운 친화력에서 인연이 붙습니다. 사람을 편안하게 만드는 분위기가 강점입니다.',
      caution: '거절을 늦게 하면 애매한 관계가 길어집니다. 다정함과 가능성은 구분해야 합니다.'
    };
  }

  return {
    title: '생활 도화 · 오래 볼수록 살아나는 매력',
    body: '첫눈에 압도하기보다 반복해서 볼수록 신뢰가 쌓이는 타입입니다. 말투, 시간 감각, 일하는 태도, 생활 정돈감에서 호감이 커집니다.',
    caution: '초반에 너무 조용하면 상대가 마음을 못 읽을 수 있습니다. 짧은 표현 하나가 관계를 살립니다.'
  };
}

function buildLoveDohwaAttractionSection(report: SajuReportData): ReportSection {
  const dohwa = getDohwaLoveText(report);

  return {
    id: 'love-dohwa-attraction',
    title: '도화·끌림 포인트',
    subtitle: '사람이 왜 붙는지, 어떤 분위기에서 매력이 살아나는지 연애 기준으로 봅니다.',
    callout: {
      title: dohwa.title,
      body: dohwa.body
    },
    cards: [
      {
        title: '처음 보이는 인상',
        body: '너무 들이대는 매력보다 “생각보다 괜찮다”, “깔끔하다”, “다시 보고 싶다”는 식으로 천천히 남습니다.'
      },
      {
        title: '가까워질수록 보이는 매력',
        body: '생활이 무너지지 않는 모습, 말한 것을 지키는 모습, 자기 일을 해내는 모습에서 상대의 호감이 커집니다.',
        tone: 'good'
      },
      {
        title: '주의할 도화',
        body: dohwa.caution,
        tone: 'warn'
      },
      {
        title: '캡처 한 줄',
        body: '이 사주의 매력은 과한 애교보다 무너지지 않는 생활감에서 나옵니다.',
        badge: 'SAVE'
      }
    ]
  };
}

function buildLoveMarriageStructureSection(report: SajuReportData): ReportSection {
  const bestMonthText = getFocusedBestMonthText(report);

  return {
    id: 'love-marriage-structure',
    title: '연애가 결혼으로 가는 구조',
    subtitle: '연애 기준과 결혼 기준은 다르게 봐야 합니다.',
    callout: {
      title: '결혼 판단',
      body: '설레는 사람과 살 수 있는 사람은 다릅니다. 이 사주는 생활이 안정될 때 결혼 생각이 진짜로 들어옵니다.'
    },
    paragraphs: [
      `${report.customerName}님은 감정만으로 결혼을 밀어붙이는 쪽보다, 상대와 함께 살 때 내 리듬이 무너지지 않는지를 봐야 합니다.`,
      `연애에서는 끌림이 중요하지만 결혼에서는 돈 관리, 가족과의 거리, 집안일, 수면, 일의 우선순위가 더 크게 작동합니다.`,
      `${bestMonthText} 전후에는 관계의 다음 단계를 이야기하기 좋습니다. 다만 분위기에 취해 결론을 내기보다 생활표를 같이 맞춰보는 편이 정확합니다.`
    ],
    cards: [
      {
        title: '결혼 가능한 사람',
        body: '내 일을 존중하고, 가족 문제에서 선을 지키며, 돈과 집안일을 감정싸움으로 만들지 않는 사람입니다.',
        tone: 'good'
      },
      {
        title: '결혼 후 부딪히는 지점',
        body: '표현 방식보다 역할 분담에서 부딪힙니다. 누가 무엇을 맡는지 흐리면 한쪽이 조용히 지칩니다.',
        tone: 'warn'
      },
      {
        title: '동거·결혼 전 확인',
        body: '잠드는 시간, 주말 사용법, 청소 기준, 지출 기준, 부모님과의 거리, 화났을 때 대화 방식을 꼭 봐야 합니다.'
      },
      {
        title: '놓치면 안 되는 사람',
        body: '느리게 다가와도 말한 것을 고치고, 내 불편함을 가볍게 넘기지 않으며, 관계를 같이 운영하려는 사람입니다.',
        tone: 'good'
      }
    ]
  };
}

function buildPremiumLoveSections(report: SajuReportData): ReportSection[] {
  const bestMonthText = getFocusedBestMonthText(report);
  const watchMonthText = getFocusedWatchMonthText(report);

  return [
    {
      id: 'love-verdict',
      title: '연애운 핵심 판정',
      subtitle: '지금 사랑이 어디서 열리고 어디서 닫히는지 먼저 봅니다.',
      callout: {
        title: '연애운 한 줄',
        body: `${report.customerName}님은 강한 고백보다 오래 흔들리지 않는 태도에 마음이 움직입니다. 좋아해도 먼저 관찰하고, 마음이 식으면 설명보다 거리로 답하는 흐름이 있습니다.`
      },
      paragraphs: [
        `이 연애운은 “누가 나를 좋아하나”보다 ${report.customerName}님이 어떤 사람 앞에서 긴장을 풀고, 어떤 사람 앞에서 금방 지치는지를 먼저 봅니다.`,
        `처음에는 상대의 가능성을 크게 봅니다. 그런데 답장 온도, 시간 쓰는 습관, 소비 감각이 흐리면 마음속에서 조용히 정리가 시작됩니다.`,
        `좋은 인연은 말이 센 사람보다 생활이 일정하고 책임감 있는 사람입니다. 빠른 고백보다 바쁜 날에도 말한 시간을 실제로 맞추는 사람이 오래 갑니다.`
      ],
      cards: [
        {
          title: '끌리는 사람',
          body: '자기 일이 있고, 말이 과하지 않으며, 바쁜 와중에도 작은 시간을 실제로 내는 사람에게 마음이 갑니다.',
          tone: 'good'
        },
        {
          title: '깨지는 패턴',
          body: '좋아도 표현이 늦어 타이밍을 놓치거나, 참다가 한 번에 마음을 닫는 장면을 조심해야 합니다.',
          tone: 'warn'
        },
        {
          title: '연애 시작 신호',
          body: '소개, 일 관련 연결, 반복적으로 마주치는 생활권에서 천천히 열리는 인연이 더 안정적입니다.'
        },
        {
          title: '피해야 할 유형',
          body: '연락은 뜨거운데 만남은 계속 밀리는 사람, 외로울 때만 찾는 사람, 현실 이야기를 피하는 사람입니다.',
          tone: 'warn'
        }
      ]
    },
    buildLoveOriginMatchSection(report),
    buildLoveAffectionSection(report),
    buildLoveShadowSection(report),
    buildLoveBreakupPatternSection(report),
    buildLoveDohwaAttractionSection(report),
    buildLoveMarriageStructureSection(report),
    {
      id: 'love-contact',
      title: '썸·연락 전략',
      subtitle: '연락 빈도보다 관계가 실제로 앞으로 가는지 봅니다.',
      details: [
        {
          summary: '먼저 연락해도 되는 때',
          content: `상대가 날짜를 제안하거나, 바쁜 와중에도 짧게라도 답을 이어가거나, 작은 약속을 지킨 흔적이 있을 때입니다.\n\n이때는 긴 감정문보다 “이번 주 언제 가능해?”처럼 짧은 제안이 좋습니다.`,
          open: true
        },
        {
          summary: '기다려야 하는 때',
          content: `상대 말은 따뜻한데 행동이 없고, 만남 약속이 계속 밀리고, 돈이나 시간을 쓰는 장면에서 뒤로 빠진다면 기다림이 길어질 수 있습니다.\n\n이때 더 잘해주면 관계가 풀리는 게 아니라, 내 자존감과 수면이 먼저 흔들립니다.`
        },
        {
          summary: '소름 포인트',
          content: `좋아하는데도 표현이 늦어서 상대가 먼저 지치는 패턴이 있습니다.\n\n반대로 마음이 식은 뒤에는 긴 대화를 해도 회복이 빠르지 않습니다. 그래서 초반에 작은 서운함을 너무 오래 묻어두면 안 됩니다.`
        }
      ]
    },
    buildFocusedMonthSection(report, '연애 월별 타이밍', `열리는 달은 ${bestMonthText}, 마음을 아껴야 할 달은 ${watchMonthText}입니다.`)
  ];
}

function buildPremiumReunionSections(report: SajuReportData): ReportSection[] {
  const bestMonthText = getFocusedBestMonthText(report);
  const watchMonthText = getFocusedWatchMonthText(report);

  return [
    {
      id: 'reunion-verdict',
      title: '재회 가능성 핵심 판정',
      subtitle: '미련인지, 다시 이어질 가능성인지, 다시 만나도 버틸 관계인지 나눕니다.',
      callout: {
        title: '재회운 한 줄',
        body: '재회는 연락이 오는지보다, 다시 만났을 때 같은 문제를 반복하지 않을 구조가 있는지가 핵심입니다.'
      },
      paragraphs: [
        `재회운은 감정 잔존도와 생활 가능성을 따로 봐야 합니다. 그리움은 남아도 다시 생활을 맞출 준비가 없으면 같은 자리에서 다시 깨집니다.`,
        `${report.customerName}님은 미련이 남아도 자존심 때문에 먼저 길게 설명하지 않는 쪽으로 반응할 수 있습니다. 겉으로는 괜찮아 보여도 마음속에서는 계속 장면을 되감는 시간이 생깁니다.`,
        `재회가 열리는 경우는 상대가 말이 아니라 태도를 바꿔서 돌아올 때입니다. 같은 사과, 같은 변명, 같은 회피라면 돌아가도 회복이 짧습니다.`
      ],
      cards: [
        {
          title: '연락 가능 신호',
          body: '과거 이야기를 꺼내기보다 현재 생활, 일정, 안부를 자연스럽게 묻는 연락이 가능성 신호입니다.',
          tone: 'good'
        },
        {
          title: '아직 위험한 신호',
          body: '외롭거나 술기운, 밤 시간에만 연락하는 흐름은 재회보다 감정 소비에 가깝습니다.',
          tone: 'warn'
        },
        {
          title: '재회 후 깨지는 이유',
          body: '처음엔 반갑지만, 연락 텀과 책임 문제가 그대로면 예전보다 더 빨리 지칩니다.'
        },
        {
          title: '멈춰야 할 기준',
          body: '상대가 내 마음은 확인하려 하면서 본인의 행동 변화는 보이지 않을 때입니다.',
          tone: 'warn'
        }
      ]
    },
    {
      id: 'reunion-message',
      title: '재회 연락 문장과 금지 문장',
      subtitle: '감정 폭발보다 다시 대화가 열리는 문장 구조가 중요합니다.',
      details: [
        {
          summary: '보내도 되는 문장',
          content: `“잘 지내? 요즘 문득 생각나서 연락했어. 부담 주려는 건 아니고, 한번 안부 묻고 싶었어.”\n\n핵심은 사과 요구나 결론 압박이 아니라 대화 문을 작게 여는 것입니다.`,
          open: true
        },
        {
          summary: '보내면 안 되는 문장',
          content: `“넌 왜 그때 그랬어?” “나만 힘들었어?” “다시 만날 생각 있어 없어?”처럼 결론을 밀어붙이는 문장은 상대의 방어를 키웁니다.\n\n재회운이 있어도 첫 문장이 심문처럼 느껴지면 문이 닫힙니다.`
        },
        {
          summary: '재회 판단 기준',
          content: `다시 만나도 되는 사람은 답장이 빠른 사람이 아니라, 과거의 문제를 피하지 않고 현재 행동을 바꾸는 사람입니다.\n\n${bestMonthText}에는 가볍게 문을 열 수 있고, ${watchMonthText}에는 감정 결론을 미루는 편이 낫습니다.`
        }
      ]
    },
    buildFocusedMonthSection(report, '재회 월별 타이밍', '전 연인 연락, 과거 감정, 다시 만남 가능성을 월별 사건성으로 나눠 봅니다.')
  ];
}

function buildPremiumMarriageSections(report: SajuReportData): ReportSection[] {
  const bestMonthText = getFocusedBestMonthText(report);

  return [
    {
      id: 'marriage-verdict',
      title: '결혼운 핵심 판정',
      subtitle: '결혼 가능성, 배우자상, 생활 안정성을 감정과 현실로 나눠 봅니다.',
      callout: {
        title: '결혼운 한 줄',
        body: '결혼은 설렘보다 생활 기준입니다. 돈, 가족 거리, 수면, 일의 속도가 맞는 사람이 오래 갑니다.'
      },
      paragraphs: [
        `${report.customerName}님의 결혼운은 “언제 하느냐”보다 “누구와 생활이 무너지지 않느냐”가 더 중요합니다.`,
        `좋은 배우자상은 말이 화려한 사람보다 일정, 돈, 가족 문제를 흐리지 않는 사람입니다. 갈등이 생겼을 때 회피하지 않고 다시 맞추는 태도가 핵심입니다.`,
        `결혼을 서두르면 감정보다 책임이 먼저 커질 수 있습니다. 반대로 현실 조건을 너무 오래 미루면 좋은 인연도 결론 없이 지칠 수 있습니다.`
      ],
      cards: [
        {
          title: '배우자상',
          body: '자기 일이 있고, 돈과 시간의 태도가 깨끗하며, 가족 문제에서 선을 그을 줄 아는 사람입니다.',
          tone: 'good'
        },
        {
          title: '결혼 적기',
          body: `${bestMonthText} 전후에는 관계의 다음 단계를 현실적으로 이야기하기 좋습니다.`
        },
        {
          title: '결혼 전 체크',
          body: '주거, 저축, 가족 거리, 집안일, 갈등 후 대화 방식을 반드시 확인해야 합니다.'
        },
        {
          title: '피해야 할 결혼',
          body: '외로움 때문에 서두르는 결혼, 돈 이야기를 미루는 결혼, 가족 경계가 없는 결혼입니다.',
          tone: 'warn'
        }
      ]
    },
    {
      id: 'marriage-reality',
      title: '결혼 현실 변수',
      subtitle: '좋아하는 마음이 생활로 버틸 수 있는지 확인합니다.',
      details: [
        {
          summary: '돈과 집',
          content: `결혼운에서 돈은 로맨스를 깨는 요소가 아니라 생활을 지키는 기준입니다.\n\n저축 방식, 고정비, 부모 지원, 대출, 각자 쓰는 돈의 선을 확인해야 합니다.`,
          open: true
        },
        {
          summary: '가족과 거리',
          content: `상대 가족과의 거리는 가까운지보다 경계가 있는지가 중요합니다.\n\n배우자가 내 편을 들어주는지, 갈등을 미루지 않고 조율하는지가 결혼 안정성을 좌우합니다.`
        },
        {
          summary: '결혼 후 모습',
          content: `결혼 후에는 감정 표현보다 생활 운영 능력이 만족도를 만듭니다.\n\n일정, 돈, 집안일을 함께 업데이트하는 사람이 맞고, 서운함을 쌓아두다 한 번에 폭발하는 방식은 줄여야 합니다.`
        }
      ]
    },
    buildFocusedMonthSection(report, '혼인·관계 월별 타이밍', '상견례, 동거, 혼인 결정, 가족 조율에 적합한 달과 조심할 달을 나눕니다.')
  ];
}

function buildPremiumCareerSections(report: SajuReportData): ReportSection[] {
  const bestMonthText = getFocusedBestMonthText(report);
  const watchMonthText = getFocusedWatchMonthText(report);
  const topTenGods = report.tenGods.slice(0, 2).map((item) => item.label).join('·') || '십성';

  return [
    {
      id: 'career-verdict',
      title: '직업운 핵심 판정',
      subtitle: '직업 이름보다 오래 버티고 평가받는 일의 구조를 봅니다.',
      callout: {
        title: '직업운 한 줄',
        body: '올해는 능력보다 결과물을 보이게 만드는 사람이 이깁니다.'
      },
      paragraphs: [
        `${report.customerName}님은 ${report.dayMaster} 일간과 ${topTenGods} 흐름이 함께 작동합니다. 그래서 막연히 열심히 하는 일보다 기준을 세우고 설명하고 결과물로 보여주는 일이 맞습니다.`,
        `맞는 일은 “시키는 대로 오래 버티는 일”보다 문제를 진단하고, 정리하고, 고객이나 조직이 이해할 수 있게 바꾸는 역할입니다.`,
        `이직이나 창업은 감정으로 움직이면 위험합니다. 포트폴리오, 샘플, 가격, 수입 공백이 준비됐을 때 운이 실제 성과로 붙습니다.`
      ],
      cards: [
        {
          title: '추천 업종',
          body: '분석·진단 컨설팅, 콘텐츠/교육, 서비스기획·PM, 상담형 상품, 고객관리·운영 개선, 리포트형 디지털 서비스가 잘 맞습니다.',
          tone: 'good'
        },
        {
          title: '맞는 역할',
          body: '문제 정의, 구조 설계, 설명, 운영 기준 만들기, 고객 경험 개선처럼 보이지 않는 혼란을 정리하는 역할입니다.'
        },
        {
          title: '피해야 할 일',
          body: '역할이 매번 바뀌고, 책임만 늘고, 결과물이 남지 않는 일입니다. 좋은 회사라도 내 이름으로 남는 성과가 없으면 지칩니다.',
          tone: 'warn'
        },
        {
          title: '움직일 시기',
          body: `${bestMonthText}에는 제안과 공개를 열고, ${watchMonthText}에는 퇴사·창업 결론을 미루는 편이 안전합니다.`
        }
      ]
    },
    {
      id: 'career-roadmap',
      title: '90일 커리어 로드맵',
      subtitle: '직업운을 포트폴리오와 수익 구조로 바꾸는 실행 순서입니다.',
      details: [
        {
          summary: '1~30일: 대표 문제 하나 고르기',
          content: `“무엇을 할 수 있다”가 아니라 “어떤 문제를 해결한다”로 문장을 바꿉니다.\n\n예: 사주를 봅니다가 아니라, 올해 직업·돈·관계 선택 기준을 정리해드립니다.`,
          open: true
        },
        {
          summary: '31~60일: 샘플 결과물 만들기',
          content: `포트폴리오는 화려한 이력보다 고객이 받게 될 결과 예시가 중요합니다.\n\n목차, 샘플 리포트, 가격표, FAQ, 환불 기준을 한 화면에 정리하세요.`
        },
        {
          summary: '61~90일: 가격과 반복 구조 고정',
          content: `단건 노동으로 끝내지 말고 기본 리포트, 프리미엄 리포트, 후속 질문, 월별 업데이트로 계단을 만드세요.\n\n직업운은 결과물이 반복될 때 돈으로 바뀝니다.`
        }
      ]
    },
    buildFocusedMonthSection(report, '직업 월별 타이밍', '이직, 창업, 제안, 포트폴리오 공개, 공부와 정비 시기를 월별로 나눕니다.')
  ];
}

function buildPremiumWealthSections(report: SajuReportData): ReportSection[] {
  const bestMonthText = getFocusedBestMonthText(report);
  const watchMonthText = getFocusedWatchMonthText(report);

  return [
    {
      id: 'wealth-verdict',
      title: '금전운 핵심 판정',
      subtitle: '돈이 들어오는 방식과 새는 장면을 먼저 분리합니다.',
      callout: {
        title: '금전운 한 줄',
        body: '돈은 들어오는 것보다 남는 구조가 먼저입니다. 가격, 정산, 반복 구매, 환불 기준이 운을 지킵니다.'
      },
      paragraphs: [
        `${report.customerName}님의 금전운은 한 방보다 누적형에 가깝습니다. 신뢰, 반복 고객, 소개, 다시 맡기는 구조에서 돈이 붙습니다.`,
        `돈이 새는 장면은 사람 때문에 시작됩니다. 가까운 사이라 가격을 흐리고, 제공 범위를 넓혀주고, 나중에 혼자 피로와 비용을 떠안는 식입니다.`,
        `투자는 빠른 수익보다 이해 가능한 구조가 먼저입니다. 누가 급하게 권한 것, 밤에 충동적으로 들어간 것, 손실을 인정하기 싫어 오래 들고 가는 방식은 맞지 않습니다.`
      ],
      cards: [
        {
          title: '돈 들어오는 방식',
          body: '반복 고객, 소개, 신뢰 기반 상품, 정기 결제, 재구매 구조에서 돈이 들어옵니다.',
          tone: 'good'
        },
        {
          title: '돈 새는 방식',
          body: '관계 지출, 새벽 결제, 무료 응대, 수정 요청 무제한, 지인 할인에서 돈과 체력이 같이 샙니다.',
          tone: 'warn'
        },
        {
          title: '투자 성향',
          body: '분산과 기록, 이해 가능한 상품이 맞습니다. 분위기에 휩쓸리는 단기 매매는 손실 피로가 큽니다.'
        },
        {
          title: '상승 시기',
          body: `${bestMonthText}에는 가격 공개와 상품 제안이 좋고, ${watchMonthText}에는 지출 방어가 우선입니다.`
        }
      ]
    },
    {
      id: 'wealth-system',
      title: '돈이 남는 시스템',
      subtitle: '금전운을 현실 계좌에 남기기 위한 운영 기준입니다.',
      details: [
        {
          summary: '가격',
          content: `가격은 착하게 보이려고 낮추는 순간 운이 새기 쉽습니다.\n\n기본가, 추가 질문, 수정 범위, 빠른 처리 옵션을 분리해야 남는 돈이 생깁니다.`,
          open: true
        },
        {
          summary: '정산',
          content: `돈 약속은 친한 사람일수록 먼저 고정해야 합니다.\n\n입금일, 취소 기준, 환불 기준, 제공 범위를 남기면 관계도 덜 상합니다.`
        },
        {
          summary: '30일 처방',
          content: `1주차: 자동결제와 구독 정리\n\n2주차: 가격표와 제공 범위 고정\n\n3주차: 무료 응대 시간 제한\n\n4주차: 반복 구매 상품 하나 만들기`
        }
      ]
    },
    buildFocusedMonthSection(report, '금전 월별 타이밍', '돈을 열 달과 지킬 달, 투자·지출을 조심할 달을 사건성으로 나눕니다.')
  ];
}

function buildFocusedPremiumReport(report: SajuReportData): SajuReportData {
  const signatureRelationSection = buildSignatureRelationReadings(report);
  const emotionalFlowSection = buildEmotionalFlowSection(report);
  const signatureStrengthLine = buildSignatureStrengthLine(report);
  const cautionGuidance = formatCautionElements(report);
  const cautionScenes = buildCautionSceneBank(report);
  const dominantLabel = report.tenGods[0]?.label || '주요 십성';
  const secondLabel = report.tenGods[1]?.label || '보조 십성';
  const categorySections =
    report.kind === 'love'
      ? buildPremiumLoveSections(report)
      : report.kind === 'reunion'
        ? buildPremiumReunionSections(report)
        : report.kind === 'marriage'
          ? buildPremiumMarriageSections(report)
          : report.kind === 'career'
            ? buildPremiumCareerSections(report)
            : buildPremiumWealthSections(report);
  const titleByKind: Partial<Record<SajuReportData['kind'], string>> = {
    love: '연애운 프리미엄 리포트',
    reunion: '재회운 프리미엄 리포트',
    marriage: '결혼운 프리미엄 리포트',
    career: '직업운 프리미엄 리포트',
    wealth: '금전운 프리미엄 리포트'
  };
  const focusLabel = titleByKind[report.kind] || report.title;
  const focusedReport: SajuReportData = {
    ...report,
    title: focusLabel,
    heroNote: `${report.customerName}님의 원국, 대운, 세운, 월운을 ${focusLabel.replace(' 프리미엄 리포트', '')} 관점으로 재구성했습니다. 한 줄 운세가 아니라 실제 선택, 말투, 돈, 관계 장면으로 읽는 5만원대 상담형 리포트입니다.`,
    summary: {
      title: `${report.customerName}님의 ${focusLabel.replace(' 프리미엄 리포트', '')} 핵심 판정`,
      analysis: [
        signatureStrengthLine,
        `현재 ${report.currentDayun.name} 대운의 실제 과제는 분명합니다. ${asSentence(report.currentDayun.focus)}`,
        `십성에서는 ${dominantLabel}과 ${secondLabel}이 앞에 있어 ${describeTenGodDepth(dominantLabel)} ${describeTenGodDepth(secondLabel)}`,
        `${cautionGuidance} 그래서 좋은 말보다 실제 일정, 답장 온도, 돈의 흐름, 수면과 체력을 같이 봐야 합니다.`
      ],
      advice: [
        '이번 리포트는 좋다/나쁘다보다 “언제 열고 언제 멈출지”를 먼저 봅니다.',
        '관계든 일이든 말보다 약속, 돈, 시간, 갈등 후 태도를 확인하세요.',
        '좋은 운도 기준 없이 열면 피로가 되고, 약한 운도 기준을 세우면 손실을 줄입니다.'
      ]
    },
    keyTakeaways: [
      {
        title: '핵심',
        body: `${focusLabel.replace(' 프리미엄 리포트', '')}은 감정이나 기대만으로 보지 않고 원국, 대운, 월운의 실제 작동 장면으로 읽었습니다.`,
        tone: 'good'
      },
      {
        title: '강점',
        body: `${dominantLabel} 흐름이 강하게 잡힐 때 ${report.customerName}님은 문제를 정리하고 상대가 이해할 수 있게 바꾸는 힘이 살아납니다.`
      },
      {
        title: '주의',
        body: cautionScenes[1],
        tone: 'warn'
      },
      {
        title: '시기',
        body: `${getFocusedBestMonthText(report)}에는 열고, ${getFocusedWatchMonthText(report)}에는 무리한 결론을 늦추는 편이 좋습니다.`
      }
    ],
    sections: [
      ...categorySections,
      emotionalFlowSection,
      signatureRelationSection,
      {
        id: 'focused-ten-gods',
        title: '십성 생활 장면 해석',
        subtitle: '십성을 점수가 아니라 말투, 돈 쓰임, 책임 반응, 관계 거리로 읽습니다.',
        details: report.tenGods.slice(0, 5).map((item, index) => ({
          summary: `${item.label} ${item.value}점 · 실제 작동 장면`,
          content: buildTenGodSceneDetail(item.label, report),
          open: index < 2
        }))
      },
      {
        id: 'focused-prescription',
        title: '프리미엄 실행 처방',
        subtitle: '읽고 끝나는 리포트가 아니라 바로 바꿀 행동을 남깁니다.',
        bullets: [
          '오늘 결정할 일과 다음 달로 미룰 일을 분리합니다.',
          '관계와 돈이 걸린 약속은 메시지로 남깁니다.',
          '좋은 흐름이 들어오는 달에는 공개와 제안을 열고, 약한 달에는 정산과 수면을 먼저 지킵니다.',
          '감정이 올라온 밤에는 이별, 퇴사, 투자, 큰 결제를 결정하지 않습니다.'
        ]
      }
    ],
    actionPlan: {
      ...report.actionPlan,
      title: `${focusLabel.replace(' 프리미엄 리포트', '')} 30일 실행 플랜`,
      priorities: [
        '1주차: 지금 가장 크게 흔드는 사람, 돈, 일, 수면 문제를 하나씩 적습니다.',
        '2주차: 열어야 할 선택과 멈춰야 할 선택을 월운 기준으로 나눕니다.',
        '3주차: 연락, 가격, 제공 범위, 약속 시간을 글로 고정합니다.',
        '4주차: 남은 결과와 남은 피로를 비교해 다음 달 행동을 줄입니다.'
      ],
      dos: [
        '좋아 보여도 일정과 돈을 먼저 확인하기',
        '답장이 늦거나 마음이 흔들릴 때 하루 뒤 다시 판단하기',
        '강한 달에는 공개하고 약한 달에는 정리하기',
        '내 체력과 수면을 망가뜨리는 선택은 좋은 운이라도 줄이기'
      ],
      avoids: [
        '외로움 때문에 관계를 열기',
        '불안해서 큰 결제나 투자를 앞당기기',
        '말뿐인 약속을 좋은 신호로 착각하기',
        '피곤한 상태에서 마지막 결론 내리기'
      ]
    }
  };

  return polishRepeatedReportLanguage(focusedReport, cautionGuidance, cautionScenes);
}

function isSelfHarmQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  return /살기싫|죽고싶|자살|극단|사라지고싶|끝내고싶|죽어버|못살겠|포기하고싶|목숨|해치고싶|왜살|살이유|사는이유|살아야할이유/.test(normalized);
}

function isExistentialCrisisQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  return /왜살|살이유|사는이유|살아야할이유/.test(normalized);
}

function getFriendlyAddressName(name: string) {
  const cleaned = name.trim().replace(/\s+/g, '');
  const blockedWords = ['테스트', '운월당', '고객', '사용자', '나', '저'];

  if (!cleaned) {
    return '당신';
  }

  const koreanOnly = cleaned.replace(/[^\uAC00-\uD7A3]/g, '');

  if (blockedWords.includes(koreanOnly || cleaned)) {
    return '당신';
  }

  if (koreanOnly.length >= 3) {
    return koreanOnly.slice(1);
  }

  return koreanOnly || cleaned;
}

function getVocativeName(name: string) {
  const friendlyName = getFriendlyAddressName(name);

  if (friendlyName === '당신') {
    return friendlyName;
  }

  return `${friendlyName}${hasFinalConsonant(friendlyName) ? '아' : '야'}`;
}

function getCasualAddressParts(name: string) {
  const friendlyName = getFriendlyAddressName(name);

  if (friendlyName === '당신') {
    return {
      vocative: '',
      titleLead: '지금은',
      opening: '지금 정말 많이 버거웠지.',
      subject: '너는',
      object: '너를',
      aloneLine: '지금 혼자 있으면'
    };
  }

  return {
    vocative: getVocativeName(name),
    titleLead: `${getVocativeName(name)}, 지금은`,
    opening: `${getVocativeName(name)}, 요즘 정말 많이 버거웠지.`,
    subject: withTopicParticle(friendlyName),
    object: withObjectParticle(friendlyName),
    aloneLine: `${withSubjectParticle(friendlyName)} 지금 혼자 있으면`
  };
}

function isCareerQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  return /뭐먹고살|먹고살|벌어먹|돈벌|일|직업|커리어|이직|퇴사|취업|직무|업종|창업|브랜드|콘텐츠|회사|진로|적성|뭘해야|뭐해야/.test(normalized);
}

function isMoneyQuestion(question: string) {
  return hasConcernKeyword(question, ['돈', '재물', '수입', '매출', '투자', '가격', '결제', '월급', '부업', '빚', '대출']);
}

function isLoveQuestion(question: string) {
  return hasConcernKeyword(question, ['연애', '결혼', '재회', '상대', '인연', '배우자', '궁합', '썸', '사랑']);
}

function isMoveLocationQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  const hasMoveIntent = /이사|거주|살곳|살지|집|동네|지역|강남|독산|역세권|월세|전세/.test(normalized);
  const hasChoiceIntent = /어디|중에|둘중|갈까|가야|좋을까|낫|비교|추천/.test(normalized);

  return hasMoveIntent && hasChoiceIntent;
}

function isLovePlaceQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  const hasLoveIntent = /연애|인연|썸|만남|애인|여자친구|남자친구/.test(normalized);
  const hasPlaceIntent = /어디|가면|장소|모임|소개|만날|동네|지역|생활권/.test(normalized);

  return hasLoveIntent && hasPlaceIntent;
}

function isCautionQuestion(question: string) {
  return hasConcernKeyword(question, ['조심', '주의', '위험', '피해야', '실수', '후회', '손실', '망하는', '안해야']);
}

function isOpportunityQuestion(question: string) {
  return hasConcernKeyword(question, ['기회', '잡아야', '성공', '풀리', '열리', '강하게', '상승', '확장']);
}

function isCleanupQuestion(question: string) {
  return hasConcernKeyword(question, ['정리', '버려', '끊어', '내려놓', '먼저', '우선', '흐름']);
}

function isMoneyCareerQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  const hasMoney = /재물|돈|수입|매출|금전|부업|사업|수익/.test(normalized);
  const hasCareer = /직업|직장|커리어|일|진로|업종|이직|퇴사|창업/.test(normalized);

  return hasMoney && hasCareer;
}

function getSignatureCareerFields(report: SajuReportData) {
  const labels = report.tenGods.slice(0, 4).map((item) => item.label);
  const fields = new Set<string>();

  if (labels.some((label) => label.includes('식') || label.includes('상'))) {
    fields.add('콘텐츠 기획·자료 제작·강의·교육');
  }

  if (labels.some((label) => label.includes('재'))) {
    fields.add('상품 설계·영업 전략·고객관리·중개형 서비스');
  }

  if (labels.some((label) => label.includes('관'))) {
    fields.add('운영관리·PM·행정·프로세스 설계');
  }

  if (labels.some((label) => label.includes('인'))) {
    fields.add('상담·코칭·연구·문서화·지식 서비스');
  }

  if (labels.some((label) => label.includes('비') || label.includes('겁'))) {
    fields.add('1인 브랜드·독립 프로젝트·프리랜서형 업무');
  }

  if (!fields.size) {
    fields.add('상담·분석·기획·운영처럼 기준을 세우고 문제를 정리해주는 일');
  }

  return Array.from(fields).slice(0, 4);
}

function getReportBasisText(report: SajuReportData) {
  const hour = report.pillars.hour ? `시주 ${report.pillars.hour}` : '시주 미상';
  const topTenGods = report.tenGods
    .slice(0, 3)
    .map((item) => `${item.label} ${item.value}점`)
    .join(', ');
  const elements = report.fiveElements.map((item) => `${item.label}${item.value}`).join('·');

  return `${report.customerName}님의 입력값(${report.birthLabel})으로 잡힌 원국은 연주 ${report.pillars.year}, 월주 ${report.pillars.month}, 일주 ${report.pillars.day}, ${hour}입니다. 오행 분포는 ${elements}, 십성 상위는 ${topTenGods || dominantLabelFallback(report)}입니다.`;
}

function dominantLabelFallback(report: SajuReportData) {
  return report.tenGods[0]?.label || '주요 십성';
}

function hasBranchPair(report: SajuReportData, left: string, right: string) {
  const branches = [report.pillars.year, report.pillars.month, report.pillars.day, report.pillars.hour || '']
    .map((pillar) => pillar.slice(-1))
    .filter(Boolean);

  return branches.includes(left) && branches.includes(right);
}

function getSignatureSharpPattern(report: SajuReportData) {
  if (hasBranchPair(report, '子', '酉')) {
    return '子酉 파가 보여서 사람을 오래 붙잡기보다, 피로가 쌓이면 답장이 짧아지고 마음속에서 먼저 정리하는 패턴이 강합니다.';
  }

  if (hasBranchPair(report, '巳', '申')) {
    return '巳申 합형이 보여서 일이 멈춰도 머리가 계속 돌아가고, 밤에 정산·일정·사람 문제를 한꺼번에 생각하기 쉽습니다.';
  }

  const weakest = [...report.fiveElements].sort((left, right) => left.value - right.value)[0]?.label || report.cautiousElements[0] || '약한 오행';

  return `${weakest} 기운이 약하게 잡혀서 마음만 앞서면 다음 단계, 관계 경계, 성장 방향이 흐려지기 쉽습니다.`;
}

function getDayunPressureText(report: SajuReportData) {
  const dayunName = report.currentDayun.name;

  if (/임|계|자|해|壬|癸|子|亥/.test(dayunName)) {
    return '사람, 연락, 돈, 이동';
  }

  if (/갑|을|인|묘|甲|乙|寅|卯/.test(dayunName)) {
    return '책임, 기준, 조직, 관계 경계';
  }

  if (/병|정|사|오|丙|丁|巳|午/.test(dayunName)) {
    return '공개, 표현, 관심, 실행 속도';
  }

  if (/경|신|申|유|庚|辛|酉/.test(dayunName)) {
    return '결과물, 말, 수정 요청, 평가';
  }

  return '책임, 일정, 고정비, 역할';
}

function getDayunDecisionRiskText(report: SajuReportData) {
  const dayunName = report.currentDayun.name;

  if (/임|계|자|해|壬|癸|子|亥/.test(dayunName)) {
    return `${dayunName} 대운의 수 기운은 생각과 감정을 깊게 만들기 때문에 새벽 결제, 새벽 손절, 새벽 장문 메시지가 손실로 이어지기 쉽습니다.`;
  }

  if (/갑|을|인|묘|甲|乙|寅|卯/.test(dayunName)) {
    return `${dayunName} 대운은 책임과 기준을 키우기 때문에 “내가 해야 하나” 싶은 일을 혼자 떠안기 쉽습니다. 맡기 전 역할, 돈, 마감부터 확인해야 합니다.`;
  }

  if (/병|정|사|오|丙|丁|巳|午/.test(dayunName)) {
    return `${dayunName} 대운은 드러나는 힘을 키우기 때문에 공개, 말, 약속이 빨라집니다. 흥분한 상태에서 약속을 크게 잡으면 뒤처리가 부담으로 돌아옵니다.`;
  }

  return `${dayunName} 대운에서는 결과와 평가가 빨리 따라옵니다. 말로만 정한 일, 수정 범위 없는 일, 정산일 없는 일은 시작 전부터 잘라야 합니다.`;
}

function getSignatureMoneyCareerVerdict(report: SajuReportData) {
  const hasWaterDayun = /임|계|자|해|壬|癸|子|亥/.test(report.currentDayun.name);

  if (hasWaterDayun) {
    return `현재 ${report.currentDayun.name} 대운은 재성 수 기운이 켜지는 구간이라 “돈”을 봐야 맞습니다. 다만 이 명식은 돈부터 좇으면 새고, 직업 구조를 잡으면 돈이 남습니다. 결론은 재물운보다 직업운, 정확히는 직업을 수익 구조로 바꾸는 쪽에 먼저 집중해야 합니다.`;
  }

  return `현재 ${report.currentDayun.name} 대운에서는 직업의 틀과 돈의 결과가 같이 움직입니다. 결론은 한쪽만 고르는 것이 아니라, 직업 방식을 먼저 정리해서 돈이 남는 구조를 만드는 쪽입니다.`;
}

function getSignatureBestIncomeModel(report: SajuReportData, fields: string[]) {
  const topTenGod = report.tenGods[0]?.label || '';
  const primaryField = fields[0] || '상담·분석·기획형 서비스';

  if (topTenGod.includes('식') || topTenGod.includes('상')) {
    return `가장 잘 맞는 수입 방식은 ${withObjectParticle(fields[0] || '콘텐츠·상담·분석형 업무')} 눈에 보이는 결과물로 남기는 것입니다. 말로만 잘하는 사람보다 제안서, 포트폴리오, 강의안, 분석표, 운영 매뉴얼처럼 “이 사람이 뭘 해냈는지” 바로 보이는 형태가 돈으로 바뀝니다.`;
  }

  if (topTenGod.includes('재')) {
    return `가장 잘 맞는 수입 방식은 사람과 돈의 흐름을 읽고, 역할과 대가를 분명히 나누는 것입니다. 부탁을 먼저 받고 금액을 나중에 말하면 손해가 커지고, 범위와 보상을 먼저 정하면 재물운이 살아납니다.`;
  }

  if (topTenGod.includes('관')) {
    return `가장 잘 맞는 수입 방식은 책임, 검수, 운영, 관리 역할을 맡아 안정적인 자리나 장기 프로젝트로 가져가는 것입니다. 한 번 크게 버는 일보다 신뢰가 쌓여 반복적으로 맡기는 일이 맞습니다.`;
  }

  return `가장 잘 맞는 수입 방식은 ${withObjectParticle(primaryField)} 자기 기준이 보이는 결과물로 만드는 것입니다. 회사 안에서는 보고서·기획안·운영표, 프리랜서나 사업에서는 포트폴리오·제안서·체크리스트가 돈을 부릅니다.`;
}

function buildSignatureQuestionAnswer(
  qa: SajuReportData['questionAnswers'][number],
  index: number,
  report: SajuReportData,
  dominantLabel: string,
  bestMonth?: SajuReportData['monthLuck'][number],
  watchMonth?: SajuReportData['monthLuck'][number]
): SajuReportData['questionAnswers'][number] {
  const question = qa.question || '';
  const bestMonthText = bestMonth ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} ${getLuckPhase(bestMonth.score)}` : '운이 열리는 달';
  const watchMonthText = watchMonth ? `${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} ${getLuckPhase(watchMonth.score)}` : '무리하지 말아야 할 달';
  const helpfulText = formatElementList(report.helpfulElements) || '보완 오행';
  const cautionText = buildConcernCautionSentence(report.cautiousElements) || '과해지는 기운은 일정과 기록으로 늦춰야 합니다.';
  const basisText = getReportBasisText(report);
  const sharpPattern = getSignatureSharpPattern(report);

  if (isSelfHarmQuestion(question)) {
    const address = getCasualAddressParts(report.customerName);
    const isExistential = isExistentialCrisisQuestion(question) || index > 0;
    const crisisTitle = isExistential
      ? `${address.titleLead} 인생 답을 혼자 결론내리면 안 돼`
      : `${address.titleLead} 혼자 버티는 날이 아니야`;
    const crisisAnalysis = isExistential
      ? `${address.opening} “나 왜 살지”라는 말은 가벼운 질문이 아니라 몸과 마음이 한계까지 밀렸다는 신호야. ${report.dayMaster} 일간은 힘든 티를 바로 내기보다 속으로 오래 붙잡고, ${report.pillars.month} 월령은 밤이 깊을수록 생각을 혼자 키우는 쪽이야. 여기에 ${report.currentDayun.name} 대운과 ${dominantLabel} 흐름이 겹치면 돈, 사람, 책임, 잠 부족이 한꺼번에 몰려서 “내 편이 없다”는 느낌이 확 커질 수 있어. ${address.subject} 지금 인생 결론을 낼 상태가 아니야. 이 명식에서 지금 가장 먼저 살릴 건 큰 의미가 아니라 몸의 온도와 사람의 연결이야. 오늘은 답을 찾는 날이 아니라 사람 옆에 붙어 있어야 하는 날이야.`
      : `${address.opening} 이 말은 그냥 푸념으로 넘길 말이 아니야. ${report.dayMaster} 일간은 힘든 티를 바로 내기보다 속으로 오래 붙잡는 쪽이고, ${report.pillars.month} 월령은 생각이 밤에 더 깊어지는 구조를 만들어. 여기에 ${report.currentDayun.name} 대운과 ${dominantLabel} 흐름이 겹치면 돈, 사람, 책임, 잠 부족이 한꺼번에 밀려오면서 “아무도 모르게 사라지고 싶다”는 식으로 마음이 닫힐 수 있어. 이건 의지가 약해서가 아니야. 지금 비어 있는 건 버틸 힘이 아니라 ${address.object} 붙잡아 줄 사람, 잠, 따뜻한 음식, 위험한 물건과의 거리야. 그러니까 오늘 결론은 하나야. 안전이 먼저야. 오늘은 혼자 있으면 안 돼.`;

    return {
      ...qa,
      title: crisisTitle,
      analysis: crisisAnalysis,
      advice: [
        `${address.aloneLine} 바로 가까운 사람에게 “나 지금 혼자 있으면 위험해. 같이 있어줘”라고 보내.`,
        '술, 약, 칼, 끈, 높은 곳, 차 키처럼 자신을 다치게 할 수 있는 물건과 장소에서 지금 바로 떨어져.',
        '한국이면 자살예방 상담전화 109로 전화해. 지금 당장 위험하면 119나 112로 바로 전화해. 해외라면 현지 응급번호나 가까운 응급실로 가.',
        `${helpfulText} 기운은 지금 “큰 결심”이 아니라 아주 작은 생활 회복으로 써야 해. 물 한 컵 마시기, 불 켜기, 침대 밖으로 나오기, 사람에게 연락하기. 오늘 목표는 인생 결론이 아니라 다음 10분을 안전하게 넘기는 거야.`
      ]
    };
  }

  if (isMoveLocationQuestion(question)) {
    const mentionsGangnam = /강남/.test(question);
    const mentionsDoksan = /독산/.test(question);
    const directTitle =
      mentionsGangnam && mentionsDoksan
        ? '거주는 독산역, 활동은 강남으로 나누는 편이 더 현실적입니다'
        : '이사는 설렘보다 고정비와 생활 리듬으로 골라야 합니다';
    const directVerdict =
      mentionsGangnam && mentionsDoksan
        ? `${report.customerName}님 기준으로 둘 중 하나를 고르라면, 집은 독산역 쪽이 더 안정적이고 강남은 일·만남·브랜딩을 여는 활동지로 쓰는 편이 맞습니다.`
        : `${report.customerName}님에게 이사는 “좋아 보이는 동네”보다 고정비, 이동 시간, 수면 리듬, 반복해서 만나는 사람의 질을 먼저 봐야 하는 선택입니다.`;

    return {
      ...qa,
      title: directTitle,
      analysis:
        `${directVerdict} ${basisText} ${report.dayMaster} 일간은 생활 기반이 흔들리면 판단이 빨라지고, ${report.currentDayun.name} 대운에서는 돈 흐름과 이동성, 사람 만나는 양이 같이 늘어납니다. 그래서 강남처럼 자극과 기회가 많은 곳은 일과 소개를 열기에는 좋지만, 주거지로 잡으면 고정비와 피로가 먼저 올라올 수 있습니다. 독산역 쪽은 화려함은 약해도 출퇴근, 생활비, 수면, 반복 루틴을 잡기 쉬워 장기적으로 운을 담는 그릇이 됩니다.`,
      advice: [
        '결론: 지금 목적이 “안정적으로 살면서 돈을 남기는 것”이면 독산역이 우선입니다. 집값, 관리비, 교통, 수면 시간을 낮춰야 다음 선택지가 생깁니다.',
        '강남은 버릴 곳이 아니라 “활동권”으로 쓰는 게 좋습니다. 미팅, 소개팅, 수업, 네트워킹, 상담, 촬영, 브랜딩은 강남에서 열고 집은 회복되는 곳으로 두세요.',
        '독산역을 고를 때는 역까지 실제 도보 시간, 밤길, 헬스장·카페·식사 동선, 가산·구디·강남 이동 시간을 꼭 보세요. 이 네 가지가 맞으면 생활 리듬이 안정됩니다.',
        '강남을 집으로 고를 수 있는 조건은 월 고정비를 내고도 6개월 현금 방어가 가능하고, 새벽 생활과 즉흥 지출을 스스로 끊을 수 있을 때입니다. 이 조건이 안 되면 기회보다 소모가 먼저 옵니다.',
        `${bestMonthText}에는 집 후보를 직접 걸어보고, ${watchMonthText}에는 계약금·보증금처럼 되돌리기 어려운 결정을 서두르지 마세요. 최종 선택은 “돈, 이동, 수면, 사람” 네 칸이 모두 70점 이상인 곳입니다.`
      ]
    };
  }

  if (isLovePlaceQuestion(question)) {
    return {
      ...qa,
      title: '연애는 번화가보다 반복해서 마주치는 생활권에서 열립니다',
      analysis:
        `질문 "${question}"의 답은 “어딜 한 번 가면 바로 생긴다”가 아니라, ${report.customerName}님이 자연스럽게 반복 출석할 수 있는 장소를 잡는 데 있습니다. ${report.dayMaster} 일간과 ${dominantLabel} 흐름에서는 처음 만난 순간의 뜨거움보다 약속을 지키는 태도, 생활 리듬, 말투의 안정감이 더 오래 갑니다. 그래서 즉흥 술자리보다 목적이 있는 모임, 운동, 수업, 지인 소개, 직장인 생활권에서 인연 체감이 큽니다.`,
      advice: [
        `1순위는 지인 소개입니다. ${report.customerName}님은 완전 낯선 만남보다 중간에 신뢰를 보증해주는 사람이 있을 때 마음을 열기 쉽습니다.`,
        '장소로 보면 강남·신논현·선릉은 소개팅, 수업, 네트워킹처럼 만남을 여는 곳으로 좋습니다. 다만 술자리만 따라가면 관계가 가볍게 끝날 수 있으니 “운동, 강의, 독서, 일 관련 모임”처럼 목적이 있는 자리가 맞습니다.',
        '독산역·가산·구로디지털단지 쪽은 직장인 생활권 인연을 보기 좋습니다. 퇴근 후 운동, 카페 작업, 스터디, 러닝 모임처럼 같은 시간대에 반복해서 보는 구조가 연애로 이어지기 쉽습니다.',
        '피해야 할 곳은 새벽 술자리, 감정 소비가 큰 번개 모임, 답장은 빠른데 약속이 흐린 사람들입니다. 설렘이 있어도 일정과 책임이 흐리면 금방 피곤해집니다.',
        `${bestMonthText}에는 소개팅과 새 모임을 열고, ${watchMonthText}에는 관계 결론을 몰아붙이지 마세요. 이번 달 할 일은 새 장소 하나를 정해 4주 연속 같은 시간에 나가는 것입니다.`
      ]
    };
  }

  if (isMoneyCareerQuestion(question)) {
    const fields = getSignatureCareerFields(report);
    const incomeModel = getSignatureBestIncomeModel(report, fields);

    return {
      ...qa,
      title: '재물운보다 직업운을 먼저 잡아야 돈이 남습니다',
      analysis:
        `${getSignatureMoneyCareerVerdict(report)} ${basisText} ${report.dayMaster} 일간은 판을 보고 기준을 세우는 쪽이고, ${report.pillars.month} 월령은 결과물, 말, 분석, 기획이 밖으로 드러나는 자리입니다. 여기에 ${dominantLabel} 흐름이 앞에 있으면 남 밑에서 시키는 대로 오래 버티는 것보다, 본인이 기준을 세워 “무엇을 해주고 얼마를 받을지”를 정할 때 돈이 붙습니다. ${sharpPattern}`,
      advice: [
        `1순위는 직업운입니다. 단, 취업운이 아니라 “내 전문성을 돈 받는 형태로 고정하는 직업운”입니다. 추천 축은 ${fields.join(', ')}입니다.`,
        incomeModel,
        `재물운은 투자 한 방보다 “내 일이 얼마짜리로 인정받는가”에서 갈립니다. 직장이라면 역할, 연봉 협상, 성과 기록을 분명히 남기고, 프리랜서나 사업이라면 단가, 제공 범위, 마감, 수정 횟수를 먼저 정해야 ${report.currentDayun.name} 대운의 ${getDayunPressureText(report)} 흐름이 실제 돈으로 남습니다.`,
        '피해야 할 방식은 무한 수정, 말로만 정한 동업, 지인 할인, 감정노동 많은 저가 상담, 성과 기준 없는 반복 업무입니다. 이런 일은 바쁘게 만들지만 통장에 남기지 못합니다.',
        `${bestMonthText}에는 내 실력이 보이는 결과물 하나를 밖으로 꺼내고, ${watchMonthText}에는 퇴사·투자·동업 같은 되돌리기 어려운 결정을 미루세요. 오늘은 “내가 돈을 받을 수 있는 역할” 1개를 정하고 대가, 범위, 마감, 책임선을 한 화면에 적는 게 먼저입니다.`
      ]
    };
  }

  if (isCareerQuestion(question)) {
    const fields = getSignatureCareerFields(report);
    const incomeModel = getSignatureBestIncomeModel(report, fields);

    return {
      ...qa,
      title: '먹고사는 방식은 직업명이 아니라 결과물로 정해야 합니다',
      analysis:
        `${basisText} 결론부터 말하면, ${report.customerName}님은 남이 정한 틀 안에서 오래 버티는 일보다 “기준을 세우고, 복잡한 문제를 정리해서, 결과물로 보여주는 일”이 맞습니다. ${report.dayMaster} 일간은 판을 보고 구조를 잡는 힘이 강하고, ${report.pillars.month} 월령과 ${dominantLabel} 흐름은 말·문서·분석·상담·운영으로 실력이 드러날 때 돈이 붙는 쪽입니다. 현재 ${report.currentDayun.name} 대운에서는 제안과 사람은 늘 수 있지만, 가격과 제공 범위가 흐리면 일만 많고 남는 돈이 적어집니다.`,
      advice: [
        `우선순위 업종은 ${fields.join(', ')}입니다. 직업명 하나보다 상담형, 분석형, 기획형, 콘텐츠형, 운영형 중 어디서 덜 지치고 오래 설명할 수 있는지 보세요.`,
        incomeModel,
        '피해야 할 일은 무한 수정, 감정노동이 많은 저가 서비스, 말로만 정한 동업, 급한 영업직, 성과 기준이 없는 반복 업무입니다.',
        `${bestMonthText}에는 내 실력이 보이는 결과물 하나를 밖으로 꺼내고, ${watchMonthText}에는 퇴사·투자·동업 같은 큰 결정을 미루세요.`,
        '오늘 할 일은 하나입니다. 내가 돈을 받을 수 있는 역할 1개를 정하고 대가, 범위, 마감 시간, 책임선을 한 화면에 적으세요.'
      ]
    };
  }

  if (isMoneyQuestion(question)) {
    return {
      ...qa,
      title: '돈은 들어오는 운보다 남는 구조가 먼저입니다',
      analysis:
        `질문 "${question}"은 돈이 생기느냐보다 어디서 새느냐를 봐야 합니다. ${report.currentDayun.name} 대운에서는 사람, 제안, 결제, 이동이 같이 늘 수 있지만 기준이 없으면 수입보다 피로가 먼저 남습니다. ${dominantLabel} 흐름은 가격표, 정산일, 제공 범위가 분명할 때 돈으로 바뀝니다.`,
      advice: [
        '가까운 사람 부탁, 급한 할인, 말로만 정한 정산은 돈을 새게 만듭니다.',
        '투자보다 먼저 현금 방어, 고정비, 반복 매출, 환불 기준을 정리하세요.',
        `${helpfulText} 기운은 기록과 반복에서 살아납니다. 하루 지출을 감정 소비, 관계 지출, 일 지출로 나눠 적으세요.`,
        cautionText
      ]
    };
  }

  if (isLoveQuestion(question)) {
    return {
      ...qa,
      title: '감정보다 반복 행동을 봐야 합니다',
      analysis:
        `질문 "${question}"은 상대 마음 하나를 맞히는 문제가 아닙니다. ${report.customerName}님은 좋아해도 표현이 늦고, 마음이 식으면 속으로 먼저 정리하는 쪽으로 반응하기 쉽습니다. ${report.dayMaster} 일간과 ${dominantLabel} 흐름에서는 끌림보다 연락 온도, 약속 이행, 갈등 후 회복 방식이 관계의 진짜 답입니다.`,
      advice: [
        '상대의 말보다 약속 시간, 답장 간격, 돈 쓰는 태도, 다툰 뒤 돌아오는 말투를 보세요.',
        '불안해서 긴 설명을 보내면 관계가 무거워집니다. “언제 볼 수 있어?”처럼 짧고 확인 가능한 질문이 낫습니다.',
        `${watchMonthText}에는 관계 결론을 몰아붙이지 말고, 내 마음이 어디서 식었는지 먼저 적어보세요.`,
        `${helpfulText} 기운을 살리면 감정을 행동으로 옮기는 속도가 좋아집니다. 표현은 늦추지 말고 작게라도 남기세요.`
      ]
    };
  }

  if (isCautionQuestion(question)) {
    return {
      ...qa,
      title: '지금 조심할 건 사람보다 흐린 약속입니다',
      analysis:
        `질문 "${question}"의 핵심은 겁을 먹으라는 뜻이 아니라, 어디서 손실이 생기는지 먼저 보라는 뜻입니다. ${report.dayMaster} 일간과 ${report.currentDayun.name} 대운, ${dominantLabel} 흐름을 같이 보면 위험은 큰 사건보다 작은 애매함에서 시작됩니다. 답장 늦은 사람을 믿고 일정을 비우거나, 가격을 말하지 못해 일을 먼저 해주거나, 피곤한 밤에 관계·퇴사·결제를 한 번에 결정하는 장면이 제일 위험합니다.`,
      advice: [
        '돈이 걸린 일은 “얼마, 언제, 어디까지”가 메시지로 남아야 합니다. 말로만 끝난 약속은 좋은 인연이 아니라 손실 후보입니다.',
        '관계에서는 말보다 반복 행동을 보세요. 약속 시간, 답장 속도, 정산 태도, 미안하다고 한 뒤 실제로 바뀌는지를 확인해야 합니다.',
        `${watchMonthText}에는 감정 퇴사, 급한 결제, 말뿐인 동업, 갑작스러운 손절을 피하세요.`,
        `${helpfulText} 기운은 생활 기준으로 써야 합니다. 잠, 식사, 가격표, 일정표가 무너지면 좋은 운도 체감되지 않습니다.`
      ]
    };
  }

  if (isOpportunityQuestion(question)) {
    return {
      ...qa,
      title: '올해 잡을 기회는 말보다 결과물이 남는 자리입니다',
      analysis:
        `질문 "${question}"은 운이 언제 오느냐보다, 왔을 때 무엇을 들고 있어야 잡히느냐가 핵심입니다. ${report.dayMaster} 일간은 막연한 기대보다 기준을 세우고 결과물을 보여줄 때 강해지고, ${dominantLabel} 흐름은 말·문서·상담·기획처럼 눈에 보이는 형태로 꺼낼수록 사람과 돈을 붙입니다. 올해 기회는 갑자기 인생이 바뀌는 한 방보다, 이미 쌓아둔 결과물이 사람 눈에 들어오는 방식으로 열립니다.`,
      advice: [
        `${bestMonthText}에는 샘플, 포트폴리오, 가격표, 소개문처럼 남에게 바로 보여줄 수 있는 결과물을 공개하세요.`,
        '기회로 남는 사람은 말이 큰 사람이 아니라 일정이 정확하고 돈 이야기를 피하지 않는 사람입니다.',
        '잡아야 할 일은 반복 판매가 가능한 일입니다. 한 번 하고 끝나는 노동보다 진단, 리포트, 후속 관리처럼 다시 팔 수 있는 구조가 좋습니다.',
        `${watchMonthText}에는 더 벌려고 벌리는 선택보다 이미 들어온 문의, 미뤄둔 정산, 흐린 약속을 정리하는 쪽이 유리합니다.`
      ]
    };
  }

  if (isCleanupQuestion(question)) {
    return {
      ...qa,
      title: '먼저 정리할 건 돈 안 남는 책임과 애매한 관계입니다',
      analysis:
        `${basisText} 지금 질문의 답은 “무엇을 더 할까”가 아니라 “무엇을 끊어야 내 운이 남을까”입니다. ${report.dayMaster} 일간은 기준을 세워야 편해지는 사주인데, ${report.currentDayun.name} 대운은 ${withObjectParticle(getDayunPressureText(report))} 한꺼번에 키웁니다. 그래서 지금 가장 먼저 정리해야 할 흐름은 사람 자체가 아니라 사람을 통해 들어오는 흐린 부탁, 정산 없는 책임, 끝없이 늘어지는 일정입니다. ${sharpPattern}`,
      advice: [
        '첫째, 돈 안 남는 책임을 정리하세요. 도와달라는 말에 먼저 움직이고 나중에 가격을 말하는 습관이 가장 빨리 새는 구멍입니다.',
        '둘째, 답장만 빠르고 실행이 느린 사람을 걸러야 합니다. 약속 시간, 정산일, 수정 요청 횟수에서 계속 흐리는 사람은 인연이 아니라 피로입니다.',
        `셋째, 밤에 커지는 결정을 낮으로 미루세요. ${getDayunDecisionRiskText(report)}`,
        `${bestMonthText}에는 공개와 제안을 열어도 됩니다. 대신 ${watchMonthText}에는 새 일을 벌리기보다 미수금, 미뤄둔 답장, 애매한 약속, 잠 부족부터 정리하세요.`,
        `오늘 바로 할 일은 세 가지입니다. 무료로 해주던 일 1개 중단하기, 가격표 1장 만들기, 답장 늦은 관계 1개를 더 이상 기다리지 않기. 이것이 ${report.customerName}님에게 지금 가장 먼저 정리할 흐름입니다.`
      ]
    };
  }

  return {
    ...qa,
    title: '질문을 실제 사건으로 쪼개야 답이 보입니다',
    analysis:
      `${basisText} 질문 "${question}"은 한 문장으로 보이지만 실제로는 돈, 관계, 일정, 체력 조건이 같이 묶인 질문입니다. ${report.dayMaster} 일간과 ${report.currentDayun.name} 대운에서는 빠른 결론보다 실제 사건을 나눠 보는 쪽이 정확합니다. ${sharpPattern} 지금 답답한 이유는 의지가 약해서가 아니라, 여러 조건이 엉켜 있는데 마음만 먼저 결론을 내리려 하기 때문입니다.`,
    advice: [
      '오늘은 답을 하나로 정하지 말고 돈, 사람, 일정, 체력 네 칸으로 나눠 적으세요.',
      `${bestMonthText}에는 작은 실행을 열고, ${watchMonthText}에는 되돌리기 어려운 결정을 피하세요.`,
      `${helpfulText} 기운은 생활에서 보완해야 실제 판단이 안정됩니다.`,
      cautionText
    ]
  };
}

function getPremiumYearStory(item: SajuReportData['yearLuck'][number], index: number) {
  const roles = [
    {
      role: '공개와 검증',
      scene: '준비한 결과물을 밖으로 꺼내 실제 반응을 보는 해',
      why: '말로만 가능성을 재는 단계에서 벗어나 제안, 판매, 만남, 공개 테스트가 현실 데이터를 줍니다.',
      action: '대표 상품이나 핵심 선택지 하나를 작게 공개하고, 반응이 온 채널과 고객층을 기록하세요.'
    },
    {
      role: '관계와 고객층 확장',
      scene: '사람이 늘고 제안이 많아지면서 선택 기준이 시험받는 해',
      why: '새 인연이 기회를 가져오지만 동시에 약속, 소개, 협업, 돈의 경계가 흐려질 수 있습니다.',
      action: '새 제안은 바로 받지 말고 역할, 비용, 마감, 책임자를 먼저 분리해 확인하세요.'
    },
    {
      role: '구조 조정',
      scene: '많이 벌린 일을 줄이고 오래 남을 방식만 고르는 해',
      why: '운이 약해서가 아니라 이전 선택의 피로와 비용이 한꺼번에 드러나는 구간입니다.',
      action: '수익이 남지 않는 일, 감정 소모가 큰 관계, 반복 수정이 많은 상품을 정리하세요.'
    },
    {
      role: '수익 모델 고정',
      scene: '반복 매출과 재방문 구조를 굳히기 좋은 해',
      why: '한 번의 성과보다 같은 사람이 다시 찾는 구조가 재물운의 안정감을 키웁니다.',
      action: '기본 상품, 프리미엄 상품, 월별 점검, 추가 질문처럼 단계형 가격표를 만드세요.'
    },
    {
      role: '재정비와 재선택',
      scene: '다음 흐름으로 넘어가기 전 몸과 돈, 관계를 다시 맞추는 해',
      why: '겉으로는 속도가 느려 보여도 내부 기준을 바로잡아야 이후 확장이 흔들리지 않습니다.',
      action: '무리한 확장보다 고객 기록, 환불 기준, 작업 시간, 건강 루틴을 먼저 손보세요.'
    }
  ];
  const role = roles[index] || roles[roles.length - 1];
  const scoreNote =
    item.score >= 80
      ? '이 해는 힘이 밖으로 드러나기 쉬워 공개와 제안에 쓰면 체감이 큽니다.'
      : item.score < 55
        ? '이 해는 밀어붙이는 것보다 새는 곳을 막을 때 손실이 줄어듭니다.'
        : '이 해는 방향을 한 번 더 고르고, 선택지를 비교하며 힘을 배분하는 쪽이 맞습니다.';

  return {
    ...role,
    phase: getLuckPhase(item.score),
    response: getLuckAction(item.score),
    cardBody: `${item.ganzhi} 세운의 역할은 “${role.role}”입니다. ${role.scene}로 읽으며, ${role.why} ${scoreNote} ${role.action}`,
    eventTitle: `${role.role} · ${role.scene}`,
    eventBody: `${item.ganzhi} 흐름에서는 ${item.summary} 그래서 실제 사건은 ${role.scene} 쪽으로 나타나기 쉽습니다. ${item.warning} 이 지점이 보이면 운이 막힌 것이 아니라 조정 신호로 보고, ${role.action}`,
    tableScene: role.scene,
    tableWhy: role.why
  };
}

function getRelationDigest(report: SajuReportData) {
  const relationSection = report.sections.find((section) => section.id === 'detailRel');
  const relationDetails = relationSection?.details?.map((detail) => detail.content).filter(Boolean) || [];

  if (relationDetails.length === 0) {
    return '형·충·합·파는 별 하나로 단정하지 않고 원국, 월령, 대운과 함께 봅니다. 이번 명식에서는 관계와 돈, 일정이 동시에 맞물리는 장면에서 체감이 커질 수 있으므로 약속과 책임 범위를 먼저 분명히 두는 편이 좋습니다.';
  }

  return relationDetails.slice(0, 2).join('\n\n');
}

function buildExpertSatisfactionReport(report: SajuReportData, options: { preserveQuestionAnswers?: boolean } = {}): SajuReportData {
  const weakestElement = [...report.fiveElements].sort((left, right) => left.value - right.value)[0];
  const strongestElement = [...report.fiveElements].sort((left, right) => right.value - left.value)[0];
  const dominantTenGod = report.tenGods[0];
  const secondTenGod = report.tenGods[1];
  const currentYear = report.yearLuck[0];
  const bestMonth = [...report.monthLuck].sort((left, right) => right.score - left.score)[0];
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];
  const helpfulText = report.helpfulElements.join(', ');
  const cautiousText = report.cautiousElements.join(', ');
  const cautionGuidance = formatCautionElements(report);
  const cautionScenes = buildCautionSceneBank(report);
  const weakestLabel = weakestElement?.label || report.cautiousElements[0];
  const strongestLabel = strongestElement?.label || report.helpfulElements[0];
  const dominantLabel = dominantTenGod?.label || '주요 십성';
  const secondLabel = secondTenGod?.label || '보조 십성';
  const climate = buildMyeongriClimate(report);
  const lifeGraphYears = report.yearLuck.slice(0, 5);
  const highYears = lifeGraphYears.filter((item) => item.score >= 80);
  const lowYears = lifeGraphYears.filter((item) => item.score < 55);
  const firstHighYear = highYears[0] || lifeGraphYears[0];
  const firstLowYear = lowYears[0] || lifeGraphYears[lifeGraphYears.length - 1];
  const signatureRelationSection = buildSignatureRelationReadings(report);
  const signatureStrengthLine = buildSignatureStrengthLine(report);
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
  const premiumYearStories = lifeGraphYears.map(getPremiumYearStory);
  const relationDigest = getRelationDigest(report);
  const businessRecommendations = [
    '상담형 분석 서비스',
    '개인 맞춤 리포트',
    '가격표가 있는 지식 상품',
    '반복 결제형 월간 점검',
    'B2B 운영 진단',
    '교육·코칭 패키지',
    '콘텐츠 기반 예약 상품',
    '고객 관리 대행',
    '프로세스 개선 컨설팅',
    '프리미엄 후속 질문권'
  ];

  const expertSummary = [
    `${report.customerName}님의 명식은 일간 ${report.dayMaster}, ${report.pillars.month} 월령, 현재 ${report.currentDayun.name} 대운을 같이 놓아야 결론이 또렷해집니다. ${climate.dayMaster} 그래서 이 사주는 단순히 “열심히 하면 된다”보다, 차가워진 판단을 어느 장면에서 데우고 어떤 관계에서 흘려보낼지를 보는 쪽이 정확합니다.`,
    signatureStrengthLine,
    `${climate.monthBasis} ${climate.johu} 오행 표가 비슷해 보여도 월령을 얻은 기운과 지지에 뿌리내린 기운은 체감 무게가 다릅니다.`,
    `${climate.wood} 이 부분이 약하면 사람을 싫어해서가 아니라, 관계의 방향이 흐릴 때 갑자기 피로가 올라옵니다. 그래서 애매한 약속, 말만 많은 제안, 끝이 보이지 않는 관계에서 먼저 지칩니다.`,
    `십성에서는 ${dominantLabel}과 ${secondLabel}의 조합을 봐야 합니다. ${describeTenGodDepth(dominantLabel)} ${describeTenGodDepth(secondLabel)}`,
    `${report.currentDayun.name} 대운은 지금의 선택이 돈, 고객, 이동, 관계의 양으로 번역되는 시기입니다. 이 흐름은 기회를 늘리는 힘이 있지만 동시에 계산되지 않은 책임도 데려옵니다. ${asSentence(report.currentDayun.focus)} ${asSentence(report.currentDayun.caution)}`,
    currentYear
      ? `${currentYear.year}년은 "${currentYear.headline}"의 해로 읽힙니다. ${asSentence(currentYear.focus)} ${asSentence(currentYear.warning)} 이 해는 사건 하나를 맞히는 방식보다, 어떤 선택지가 실제로 사람·돈·일정의 변화를 부르는지 관찰해야 합니다.`
      : `${report.customerName}님에게 올해 필요한 태도는 빠른 결정보다 검증입니다. 감정적으로 끌리는 선택이라도 일정, 비용, 사람의 태도, 내 체력까지 확인한 뒤 움직일 때 손실이 줄어듭니다.`,
    bestMonth && watchMonth
      ? `가까운 월운은 점수보다 사건성으로 봐야 합니다. ${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')}은 ${getSignatureMonthScene(bestMonth, report).event} 반대로 ${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')}은 ${getSignatureMonthScene(watchMonth, report).event}`
      : `월운은 좋고 나쁨의 점수보다 확장기, 조율기, 정비기처럼 역할을 나눠 읽어야 합니다. 그래야 고객이 “왜 그 달에 그런 일이 생기는지”를 납득할 수 있습니다.`,
    `종합하면 이 사주의 핵심은 차분한 판단력을 결과물과 계산력으로 쓰되, 사람을 설득하는 온도와 다음 단계의 방향성을 놓치지 않는 것입니다. ${withTopicParticle(`${helpfulText} 기운`)} 생활 리듬과 상품 구조 안에서 쓰고, ${cautionGuidance} 그때 좋은 운이 말뿐인 위로가 아니라 실제 매출, 관계 안정, 체력 회복으로 내려옵니다.`
  ];

  const expertQuestionAnswers = options.preserveQuestionAnswers
    ? report.questionAnswers
    : report.questionAnswers.map((qa, index) =>
        buildSignatureQuestionAnswer(qa, index, report, dominantLabel, bestMonth, watchMonth)
      );

  const expertSections = report.sections.filter((section) => !['saju', 'logic'].includes(section.id)).map((section) => {
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

    if (section.id === 'month') {
      return {
        ...section,
        title: '월운 사건성 리딩',
        subtitle: '점수보다 그 달에 실제로 생길 수 있는 연락, 돈, 몸 상태, 관계 변화를 먼저 봅니다.',
        details: report.monthLuck.map((item, index) => ({
          summary: getSignatureMonthSummary(item, report),
          content: buildSignatureMonthContent(item, report),
          open: index === 0
        }))
      };
    }

    if (section.id === 'ten') {
      return {
        ...section,
        title: '십성 생활 장면 해석',
        subtitle: '십성은 점수표가 아니라 말투, 돈 쓰임, 책임 반응, 관계 거리로 드러납니다.',
        details: report.tenGods.slice(0, 6).map((item, index) => ({
          summary: `${item.label} ${item.value}점 · 실제 작동 장면`,
          content: buildTenGodSceneDetail(item.label, report),
          open: index < 2
        }))
      };
    }

    if (section.id === 'detailRel') {
      return {
        ...section,
        title: '형·충·합·파 실제 해석',
        subtitle: '추상적인 관계 조율이 아니라 연락, 신뢰, 피로, 손절 패턴으로 번역합니다.',
        cards: signatureRelationSection.cards,
        details: signatureRelationSection.details?.length ? signatureRelationSection.details : section.details
      };
    }

    if (section.id === 'detailSal') {
      const dohwaDetails = signatureRelationSection.details?.filter((detail) => detail.summary.includes('도화')) || [];

      return {
        ...section,
        title: '도화와 평판 작동 방식',
        subtitle: '매력 하나가 아니라 소개, 후기, 신뢰, 유지 피로까지 함께 봅니다.',
        details: [
          ...dohwaDetails,
          ...(section.details || [])
        ]
      };
    }

    if (section.id === 'element') {
      return {
        ...section,
        callout: {
          title: '오행을 숫자만 보면 틀리는 이유',
          body: `${signatureStrengthLine} ${climate.elementReading}`
        },
        paragraphs: [
          signatureStrengthLine,
          `이 명식은 금수 환경에서 판단과 계산이 빨라지지만, 피곤하면 말투가 차가워지고 관계를 먼저 정리하고 싶어집니다.`,
          `목 기운이 비면 성장 방향과 관계 조율이 늦어져, 좋은 사람을 만나도 다음 단계 제안이 애매해질 수 있습니다.`
        ],
        details: section.details
      };
    }

    if (section.id === 'fortune') {
      return {
        ...section,
        callout: {
          title: `${report.currentDayun.name} 대운 핵심`,
          body: `${report.currentDayun.summary} ${report.currentDayun.caution}`
        }
      };
    }

    return section;
  });

  const wongukDepthSection: ReportSection = {
    id: 'wonguk-depth',
    title: '원국 심층 판독',
    subtitle: '일주, 월령, 십성, 형충합을 따로 흩어 보지 않고 한 사람의 반복 패턴으로 읽습니다.',
    callout: {
      title: `${report.pillars.day} 일주와 ${report.pillars.month} 월령의 핵심`,
      body: `${report.dayMaster} 일간은 기준을 세울 때 강해지고, ${report.pillars.month} 월령은 사회에서 어떤 압력을 먼저 체감하는지 보여줍니다. 그래서 이 리포트는 성격 설명보다 “어떤 상황에서 판단이 빨라지고, 어디서 피로가 쌓이며, 무엇을 남겨야 운이 살아나는가”를 중심으로 봅니다.`
    },
    cards: [
      {
        title: '일간의 실제 모습',
        body: `${climate.dayMaster} 겉으로는 차분해 보여도 안에서는 책임과 손익을 계속 계산합니다. 이 장점은 기준표가 있을 때 실력이 되고, 기준이 없을 때는 혼자 떠안는 부담으로 변합니다.`,
        tone: 'good'
      },
      {
        title: '월령의 압력',
        body: `${climate.monthBasis} 같은 오행 수치라도 월령을 받은 기운은 생활 체감이 훨씬 큽니다. 그래서 단순히 표만 보고 “균등하다”고 말하면 실제 상담 감각이 떨어집니다.`
      },
      {
        title: '십성의 생활 번역',
        body: `${dominantLabel}은 ${describeTenGodDepth(dominantLabel)} ${secondLabel}은 ${describeTenGodDepth(secondLabel)} 이 조합은 말보다 결과물, 감정보다 반복 행동을 통해 신뢰를 얻는 구조로 읽습니다.`
      },
      {
        title: '형·충·합·파 포인트',
        body: '형충합은 사건을 겁주는 장치가 아니라 삶에서 압력이 모이는 접점입니다. 연락, 계약, 돈, 일정이 한꺼번에 겹치는 날에는 결정 속도보다 순서 정리가 먼저입니다.',
        tone: 'warn'
      }
    ],
    details: [
      {
        summary: '이번 명식의 관계·사건성 근거',
        content: relationDigest,
        open: true
      }
    ]
  };

  const customerResonanceSection: ReportSection = {
    id: 'customer-resonance',
    title: '고객 체감 진단',
    subtitle: '읽는 사람이 “내 이야기 같다”고 느끼는 실제 장면을 중심으로 정리했습니다.',
    cards: [
      {
        title: '왜 돈이 잘 안 남는가',
        body: '수입이 적어서보다 사람 정, 즉흥 할인, 역할이 불분명한 일 때문에 새는 구조가 생기기 쉽습니다. 돈이 들어오는 순간보다 제공 범위와 수정 횟수를 정하는 순간이 더 중요합니다.',
        tone: 'warn'
      },
      {
        title: '왜 관계를 갑자기 끊고 싶어지는가',
        body: '처음에는 이해하려고 하지만 약속, 말투, 책임감이 반복해서 어긋나면 내부 기준선이 급격히 올라갑니다. 그래서 겉으로는 조용하다가 어느 날 마음이 닫힌 것처럼 보일 수 있습니다.'
      },
      {
        title: '왜 일은 많은데 성과가 흐려지는가',
        body: '능력이 부족해서가 아니라 제안, 제작, 응대, 정산, 수정이 한 사람에게 몰릴 때 집중력이 흩어집니다. 이 사주는 일을 더 하는 것보다 일을 나누는 방식에서 수익성이 살아납니다.'
      },
      {
        title: '어떤 상품을 팔아야 하는가',
        body: `${businessRecommendations.slice(0, 5).join(', ')}처럼 결과물이 보이고 가격표가 있는 상품이 맞습니다. 감으로 봐주는 방식보다 “진단 → 해석 → 실행안” 순서가 분명할수록 만족도가 올라갑니다.`,
        tone: 'good'
      }
    ],
    details: [
      {
        summary: '상담받는 느낌을 만드는 핵심 문장',
        content: `${report.customerName}님은 큰 꿈이 없어서 멈추는 타입이 아니라, 책임과 결과를 너무 빨리 계산해서 시작 전부터 피로를 먼저 느끼는 쪽에 가깝습니다.\n\n그래서 올해의 핵심은 “더 열심히”가 아니라 “내가 감당할 수 있는 판만 남기는 것”입니다. 사람도, 돈도, 일도 같은 원리입니다.`,
        open: true
      }
    ]
  };

  const premiumBonusSection: ReportSection = {
    id: 'premium-bonus',
    title: '프리미엄 보너스',
    subtitle: '고가 리포트에서 고객이 실제로 저장하고 다시 보는 실행 항목입니다.',
    cards: [
      {
        title: '90일 실행 플랜',
        body: '1~30일은 대표 상품 하나를 정리하고, 31~60일은 가격표와 샘플 결과물을 고정하며, 61~90일은 실제 고객 반응을 보고 문구와 제공 범위를 다듬는 흐름이 맞습니다.',
        tone: 'good'
      },
      {
        title: '올해 돈 버는 구조',
        body: '기본 리포트로 유입을 만들고, 프리미엄 심층 리포트와 월별 점검으로 재방문을 받는 구조가 좋습니다. 단건 판매보다 계단형 상품이 재물운을 안정시킵니다.'
      },
      {
        title: '피해야 할 동업·고객 유형',
        body: '말은 좋지만 마감과 비용을 흐리는 사람, 처음부터 예외를 요구하는 고객, 책임자는 없고 의견만 많은 협업은 피로를 크게 만듭니다.',
        tone: 'warn'
      },
      {
        title: '직업·사업 추천 10가지',
        body: businessRecommendations.join(' · ')
      },
      {
        title: '연애·결혼 별도 심층',
        body: '관계는 끌림보다 생활 기준이 맞아야 오래 갑니다. 연락 템포, 돈 쓰는 태도, 갈등 후 대화 방식이 맞는 사람이 결혼 현실성까지 이어지기 쉽습니다.'
      },
      {
        title: '월별 액션 체크리스트',
        body: '강한 달에는 공개와 제안을 열고, 조율 달에는 계약과 가격을 정리하고, 회복 달에는 건강과 관계 소모를 줄입니다. 월운은 점수보다 역할표로 써야 실전성이 올라갑니다.',
        tone: 'good'
      }
    ]
  };

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
        body: describeTenGodDepth(dominantLabel)
      },
      {
        title: `${secondLabel} 해석`,
        body: describeTenGodDepth(secondLabel)
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
    cards: lifeGraphYears.map((item, index) => ({
      title: `${item.year}년 · ${premiumYearStories[index]?.role || getYearLuckPhase(item)}`,
      body: premiumYearStories[index]?.cardBody || `${item.headline}. ${asSentence(item.focus)} ${asSentence(item.warning)}`,
      tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
    })),
    details: [
      {
        summary: '그래프를 읽는 법',
        content: `공개기는 좋은 일만 생긴다는 뜻이 아닙니다. 준비한 일을 밖으로 꺼내고, 사람을 만나고, 반응을 확인하기 좋은 구간입니다.\n\n정비기와 회복기는 실패의 표시가 아니라 비용 점검, 관계 재편, 체력 회복을 통해 다음 흐름을 받을 공간을 만드는 시간입니다.`,
        open: true
      }
    ]
  };

  const eventTimelineSection: ReportSection = {
    id: 'event-timeline',
    title: '사건 타임라인',
    subtitle: '언제 무엇이 왜 움직일 수 있는지 시기별로 압축했습니다.',
    cards: lifeGraphYears.map((item, index) => {
      const yearStory = premiumYearStories[index];

      return {
        title: `${item.year}년 · ${yearStory?.eventTitle || getYearEventTitle(item, index)}`,
        body: yearStory?.eventBody || `${item.ganzhi} 세운은 ${item.summary} ${asSentence(item.focus)} ${asSentence(item.warning)}`,
        tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
      };
    }),
    table: {
      headers: ['시기', '발생 가능 장면', '왜 그런가', '대응'],
      rows: lifeGraphYears.map((item, index) => [
        `${item.year}년`,
        premiumYearStories[index]?.tableScene || getYearLuckPhase(item),
        premiumYearStories[index]?.tableWhy || `${item.ganzhi} 흐름과 ${report.currentDayun.name} 대운의 결합`,
        premiumYearStories[index]?.action || getYearLuckAction(item)
      ])
    }
  };

  const yongsinSection: ReportSection = {
    id: 'yongsin',
    title: '용신·희신 분석',
    subtitle: '왜 어떤 기운은 필요하고 어떤 기운은 과하면 흔들리는지 설명합니다.',
    callout: {
      title: `${helpfulText} 흐름이 필요한 이유`,
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

  const emotionalFlowSection = buildEmotionalFlowSection(report);

  const expertCheckSection: ReportSection = {
    id: 'expert-check',
    title: '전문가 검증 포인트',
    subtitle: '결론을 받아들이기 전에 함께 확인해야 할 근거를 따로 정리했습니다.',
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
        body: `${report.currentDayun.name} 대운의 핵심은 들어온 기회를 내 구조로 바꾸는 데 있습니다. ${asSentence(report.currentDayun.focus)} 다만 ${asSentence(report.currentDayun.caution)}`
      },
      {
        title: '현실 검증',
        body: '좋은 운도 일정, 가격, 관계 태도, 체력 관리가 무너지면 체감되지 않습니다. 그래서 모든 조언은 행동으로 확인 가능한 기준으로 번역했습니다.'
      },
      {
        title: '단정 금지',
        body: '배우자, 질병, 사고, 투자 성과처럼 삶을 크게 흔드는 사건은 결과를 단언하지 않습니다. 대신 위험 신호와 선택 기준을 알려드립니다.',
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

  const expertReport: SajuReportData = {
    ...report,
    heroNote: `${report.customerName}님의 원국, 대운, 세운, 월운, 질문 맥락을 함께 검토한 프리미엄 상담형 리포트입니다. 단순한 위로보다 실제 선택에 도움이 되는 근거와 행동 기준을 우선했습니다.`,
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 핵심 판정`,
      analysis: expertSummary,
      advice: [
        `오늘 바로 할 일은 한 가지입니다. 지금 가장 중요한 선택을 “돈, 일정, 사람, 체력” 네 칸으로 나누어 적고, 빠진 칸이 있으면 아직 결정하지 마세요.`,
        `${helpfulText} 흐름은 생활 리듬이 받쳐줄 때 가장 잘 살아납니다. 수면, 식사, 이동, 업무 시작 시간을 일정하게 잡으면 판단의 흔들림이 줄어듭니다.`,
        `${cautionGuidance} 중요한 답변은 바로 보내기보다 다음 날 오전에 다시 읽어보세요.`,
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
        body: `${cautionGuidance} 판단이 급해지는 날에는 결제, 계약, 이직, 관계 정리를 바로 끝내지 말고 오전에 다시 확인하세요.`,
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
      wongukDepthSection,
      myeongriBasisSection,
      lifeGraphSection,
      signatureRelationSection,
      emotionalFlowSection,
      eventTimelineSection,
      yongsinSection,
      customerResonanceSection,
      careerDetailSection,
      relationshipPatternSection,
      premiumBonusSection,
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
        '중요한 결정은 일정표와 숫자로 확인한 뒤 진행하기',
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
      '본 리포트는 입력값과 명리학적 해석을 바탕으로 한 상담형 콘텐츠이며, 질병 진단, 투자 판단, 법률 판단, 특정 사건의 단정 예언으로 사용해서는 안 됩니다.'
    ]
  };

  return polishRepeatedReportLanguage(expertReport, cautionGuidance, cautionScenes);
}

type ReportPageCopy = {
  coverTitle: string;
  summaryCaption: string;
  qaTitle: string;
  qaCaption: string;
  glanceTitle: string;
  glanceCaption: string;
  tocTitle: string;
};

const REPORT_PAGE_COPY: Partial<Record<SajuReportData['serviceId'], ReportPageCopy>> = {
  'general-signature': {
    coverTitle: '종합사주 리포트',
    summaryCaption: '사주 전체 구조와 지금 가장 중요한 선택 기준을 먼저 정리했습니다.',
    qaTitle: '질문 맞춤 해답',
    qaCaption: '입력한 질문 2개를 원국, 대운, 세운과 연결해 읽었습니다.',
    glanceTitle: '사주 원국 핵심 지표',
    glanceCaption: '원국, 오행, 십성의 계산값을 먼저 확인합니다.',
    tocTitle: '종합사주 전체 흐름 보기'
  },
  'life-flow': {
    coverTitle: '신년운세 리포트',
    summaryCaption: '올해와 내년 사이 열리는 상승기, 정비기, 선택 타이밍을 먼저 정리했습니다.',
    qaTitle: '올해 질문 답변',
    qaCaption: '올해의 선택, 이동, 관계, 돈 흐름을 질문과 연결해 읽었습니다.',
    glanceTitle: '신년운세 기준 지표',
    glanceCaption: '올해 운을 보기 전에 원국과 대운의 기본값을 확인합니다.',
    tocTitle: '신년운세 흐름표 보기'
  },
  'concern-reading': {
    coverTitle: '고민풀이 사주 리포트',
    summaryCaption: '입력한 두 가지 고민이 사주 구조에서 어디와 연결되는지 먼저 정리했습니다.',
    qaTitle: '고민별 결론',
    qaCaption: '질문별 결론, 명리 근거, 바로 할 행동을 함께 정리했습니다.',
    glanceTitle: '고민풀이 기준 지표',
    glanceCaption: '원국, 십성, 오행의 기본값을 고민 해석의 근거로 확인합니다.',
    tocTitle: '고민풀이 전체 흐름 보기'
  },
  'love-reading': {
    coverTitle: '연애운 리포트',
    summaryCaption: '감정선, 연락 온도, 끌리는 사람과 오래 가는 사람의 차이를 먼저 정리했습니다.',
    qaTitle: '연애 질문 답변',
    qaCaption: '썸, 연락, 고백, 거리감에 대한 질문을 관계 장면으로 풀었습니다.',
    glanceTitle: '연애운 기준 지표',
    glanceCaption: '원국과 십성에서 감정 표현, 끌림, 관계 체력을 확인합니다.',
    tocTitle: '연애운 전체 흐름 보기'
  },
  'love-reunion': {
    coverTitle: '재회운 리포트',
    summaryCaption: '남은 감정, 다시 연락해도 되는 구간, 멈춰야 할 신호를 먼저 정리했습니다.',
    qaTitle: '재회 질문 답변',
    qaCaption: '재접촉 가능성보다 현실적인 거리 조절과 연락 전략을 중심으로 읽었습니다.',
    glanceTitle: '재회운 기준 지표',
    glanceCaption: '원국과 대운에서 미련, 거리감, 회복력을 확인합니다.',
    tocTitle: '재회운 전체 흐름 보기'
  },
  'match-couple': {
    coverTitle: '사주궁합 리포트',
    summaryCaption: '두 사람의 끌림, 생활 리듬, 갈등 포인트와 오래 가는 조건을 먼저 정리했습니다.',
    qaTitle: '궁합 질문 답변',
    qaCaption: '좋다/나쁘다보다 실제 관계를 운영하는 기준으로 답했습니다.',
    glanceTitle: '궁합 기준 지표',
    glanceCaption: '개인의 원국과 관계 성향을 먼저 확인한 뒤 궁합을 해석합니다.',
    tocTitle: '사주궁합 전체 흐름 보기'
  },
  'match-destiny': {
    coverTitle: '운명 궁합 리포트',
    summaryCaption: '이 인연이 오래 갈 사람인지, 강하게 스쳐 갈 사람인지 먼저 정리했습니다.',
    qaTitle: '운명 궁합 질문 답변',
    qaCaption: '관계의 무게감, 미래 확장성, 현실 안정성을 중심으로 읽었습니다.',
    glanceTitle: '운명 궁합 기준 지표',
    glanceCaption: '개인의 원국과 관계 성향을 먼저 확인한 뒤 인연의 역할을 해석합니다.',
    tocTitle: '운명 궁합 전체 흐름 보기'
  },
  'marriage-blueprint': {
    coverTitle: '결혼운 설계도',
    summaryCaption: '배우자 흐름, 결혼 안정감, 생활 조건과 현실 체크 포인트를 먼저 정리했습니다.',
    qaTitle: '결혼 질문 답변',
    qaCaption: '결혼 가능성보다 생활 기준과 현실 조건을 중심으로 답했습니다.',
    glanceTitle: '결혼운 기준 지표',
    glanceCaption: '원국과 대운에서 배우자상, 책임감, 생활 안정감을 확인합니다.',
    tocTitle: '결혼운 전체 흐름 보기'
  },
  'marriage-timing': {
    coverTitle: '혼인 시기 리포트',
    summaryCaption: '서두를 때와 기다릴 때, 현실적으로 움직이기 좋은 구간을 먼저 정리했습니다.',
    qaTitle: '혼인 시기 질문 답변',
    qaCaption: '혼인 적기, 준비 변수, 관계 안정도를 중심으로 답했습니다.',
    glanceTitle: '혼인 시기 기준 지표',
    glanceCaption: '원국과 대운에서 결혼운의 문이 열리는 방식을 확인합니다.',
    tocTitle: '혼인 시기 전체 흐름 보기'
  }
};

function getReportPageCopy(report: SajuReportData): ReportPageCopy {
  return (
    REPORT_PAGE_COPY[report.serviceId] || {
      coverTitle: report.title,
      summaryCaption: '이번 리포트의 핵심과 지금 가장 중요한 포인트를 먼저 정리했습니다.',
      qaTitle: '질문 맞춤 답변',
      qaCaption: '입력한 질문을 현재 운의 흐름과 연결해 읽었습니다.',
      glanceTitle: '핵심 지표 요약',
      glanceCaption: '원국, 오행, 십성의 기준값을 확인합니다.',
      tocTitle: '리포트 전체 흐름 보기'
    }
  );
}

function getSection(report: SajuReportData, id: string) {
  return report.sections.find((section) => section.id === id);
}

function compactSections(sections: Array<ReportSection | undefined>): ReportSection[] {
  const seen = new Set<string>();
  return sections.filter((section): section is ReportSection => {
    if (!section || seen.has(section.id)) {
      return false;
    }

    seen.add(section.id);
    return true;
  });
}

function buildMonthStageSection(report: SajuReportData, title = '월별 흐름 전략'): ReportSection {
  return {
    id: 'month-stage',
    title,
    subtitle: '점수보다 공개기, 확장기, 조율기, 정비기, 회복기로 나누어 읽습니다.',
    details: report.monthLuck.slice(0, 12).map((item, index) => ({
      summary: `${item.year}.${String(item.month).padStart(2, '0')} · ${getLuckPhase(item.score)}`,
      content: `${item.summary}\n\n집중 포인트: ${item.focus}\n\n주의 포인트: ${item.warning}\n\n실전 사용법: ${getLuckAction(item.score)}`,
      open: index < 2
    }))
  };
}

function buildProductQuestionAnswers(report: SajuReportData, productLabel: string, focusSentence: string) {
  return report.questionAnswers.map((qa, index) => ({
    ...qa,
    title: `${productLabel} 질문 ${index + 1}: ${qa.title.replace(/^첫 번째 질문 핵심 판정:\s*|^두 번째 질문 핵심 판정:\s*/, '')}`,
    analysis: `${qa.analysis} ${focusSentence}`,
    advice: [
      ...qa.advice.slice(0, 2),
      '결론을 확정처럼 받아들이기보다, 7일 안에 확인 가능한 행동 하나로 현실 반응을 보세요.'
    ]
  }));
}

function buildLifeFlowProductReport(report: SajuReportData): SajuReportData {
  const firstYear = report.yearLuck[0];
  const secondYear = report.yearLuck[1];
  const bestMonth = [...report.monthLuck].sort((left, right) => right.score - left.score)[0];
  const watchMonth = [...report.monthLuck].sort((left, right) => left.score - right.score)[0];
  const yearlyCompass: ReportSection = {
    id: 'yearly-compass',
    title: '올해 운세 핵심 나침반',
    subtitle: '한 해를 좋다/나쁘다로 자르지 않고 어떤 역할의 시기인지 봅니다.',
    callout: {
      title: firstYear ? `${firstYear.year}년 · ${firstYear.headline}` : '올해 핵심 흐름',
      body: firstYear
        ? `${firstYear.summary} 올해는 ${firstYear.focus}에 힘을 싣되, ${firstYear.warning} 이 부분은 시작 전부터 조건을 나눠 확인해야 합니다.`
        : `${report.currentDayun.name} 대운 안에서 올해는 실행기와 정비기를 나누어 쓰는 것이 핵심입니다.`
    },
    cards: [
      {
        title: '올해의 역할',
        body: firstYear ? `${getLuckPhase(firstYear.score)}입니다. ${getLuckAction(firstYear.score)} 쪽으로 쓰면 체감이 좋아집니다.` : '올해는 움직임과 정리를 구분해 써야 합니다.',
        tone: 'good'
      },
      {
        title: '내년으로 넘길 자산',
        body: secondYear ? `${secondYear.year}년에는 ${secondYear.focus} 흐름이 이어집니다. 올해 만든 기준이 내년 선택의 자산이 됩니다.` : '올해 정리한 기준이 다음 흐름의 기반이 됩니다.'
      },
      {
        title: '좋은 달',
        body: bestMonth ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')}은 ${getLuckPhase(bestMonth.score)}입니다. 공개, 제안, 테스트에 쓰기 좋습니다.` : '좋은 달에는 공개와 실행을 겁내지 않는 편이 좋습니다.',
        tone: 'good'
      },
      {
        title: '조심할 달',
        body: watchMonth ? `${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')}은 ${getLuckPhase(watchMonth.score)}입니다. 관계 정리, 비용 점검, 체력 회복에 쓰세요.` : '약한 달에는 확장보다 정리와 회복이 먼저입니다.',
        tone: 'warn'
      }
    ]
  };

  return {
    ...report,
    title: '신년운세 프리미엄 리포트',
    subtitle: '올해와 내년의 상승기, 정비기, 월별 선택 타이밍을 한눈에 정리한 연간 리포트',
    badge: '신년운세 감정서',
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 신년운세 핵심 결론`,
      analysis: [
        `${report.customerName}님의 올해 운은 ${report.currentDayun.name} 대운 안에서 봐야 정확합니다. 좋은 해인지보다 어떤 장면에서 힘을 쓰고 어디서 속도를 줄일지가 더 중요합니다.`,
        firstYear
          ? `${firstYear.year}년은 ${firstYear.headline} 흐름입니다. ${asSentence(firstYear.focus)} ${asSentence(firstYear.warning)}`
          : '올해는 실행기와 정비기를 나눠 쓰는 해입니다.',
        bestMonth && watchMonth
          ? `${bestMonth.year}.${String(bestMonth.month).padStart(2, '0')} 전후에는 열고, ${watchMonth.year}.${String(watchMonth.month).padStart(2, '0')} 전후에는 닫고 정리하는 식으로 월별 역할을 나누세요.`
          : '월별 흐름은 점수보다 공개기, 조율기, 회복기로 나눠 읽어야 현실 적용이 쉽습니다.'
      ],
      advice: [
        '올해 목표는 한 문장으로 줄이고, 월별로 공개·정리·회복의 역할을 나누세요.',
        '좋은 달에는 작게라도 세상에 내보내고, 약한 달에는 돈과 관계의 새는 구멍을 막으세요.',
        '신년운세는 예언이 아니라 12개월 운영표로 쓰는 것이 가장 실용적입니다.'
      ]
    },
    questionAnswers: buildProductQuestionAnswers(
      report,
      '신년운세',
      '이 답은 올해의 공개기, 조율기, 회복기를 나눠 적용할 때 현실성이 올라갑니다.'
    ),
    sections: compactSections([
      yearlyCompass,
      getSection(report, 'life-graph'),
      getSection(report, 'event-timeline'),
      buildMonthStageSection(report, '12개월 월별 운세 전략'),
      getSection(report, 'myeongri-basis'),
      getSection(report, 'yongsin'),
      getSection(report, 'expert-check')
    ]),
    actionPlan: {
      ...report.actionPlan,
      title: '신년운세 30일 준비표',
      priorities: [
        '1주차: 올해 목표를 일, 돈, 관계, 건강 네 칸으로 나누어 적습니다.',
        '2주차: 좋은 달에는 무엇을 공개할지, 약한 달에는 무엇을 정리할지 정합니다.',
        '3주차: 돈과 일정이 새는 구멍을 하나 줄입니다.',
        '4주차: 다음 달 실행 항목을 하나만 남기고 나머지는 보류합니다.'
      ]
    }
  };
}

function buildLoveProductReport(report: SajuReportData): SajuReportData {
  const loveCore: ReportSection = {
    id: 'love-core',
    title: '연애운 핵심 진단',
    subtitle: '상대 마음보다 먼저 봐야 할 내 감정선과 관계 체력',
    callout: {
      title: '결론 먼저',
      body: `${report.customerName}님의 연애운은 설렘의 크기보다 연락 온도, 약속 태도, 갈등 후 회복 방식에서 답이 나옵니다. 끌림은 생겨도 오래 가는 사람은 생활 장면에서 편안한 사람입니다.`
    },
    cards: [
      {
        title: '지금 감정선',
        body: '마음은 움직이지만 확신이 늦게 따라오는 흐름입니다. 답장을 기다리며 혼자 결론을 내리기보다, 짧고 분명한 확인 질문이 관계를 가볍게 만듭니다.'
      },
      {
        title: '끌리는 사람',
        body: '차분해 보이지만 자기 기준이 있고, 말보다 행동으로 신뢰를 주는 사람에게 마음이 움직이기 쉽습니다.',
        tone: 'good'
      },
      {
        title: '망하는 패턴',
        body: '상대가 애매하게 굴 때 바로 결론을 내리거나, 너무 오래 참다가 한 번에 끊어내는 패턴을 조심해야 합니다.',
        tone: 'warn'
      },
      {
        title: '30일 행동',
        body: '긴 감정 설명보다 약속 가능한 날짜, 연락 가능한 시간, 내가 원하는 관계 속도를 짧게 말해보세요.'
      }
    ]
  };

  const loveTiming: ReportSection = {
    id: 'love-timing',
    title: '인연 시기와 만남 루트',
    subtitle: '언제 누구를 만날지 단정하지 않고, 인연이 열리기 쉬운 장면을 읽습니다.',
    cards: report.yearLuck.slice(0, 4).map((item) => ({
      title: `${item.year}년 · ${getLuckPhase(item.score)}`,
      body: `${item.headline}. 이 시기에는 ${item.focus} 흐름이 관계 장면으로도 나타날 수 있습니다. ${item.warning}`,
      tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
    })),
    details: [
      {
        summary: '만남이 열리기 쉬운 곳',
        content:
          '완전히 우연한 만남보다 반복적으로 마주치는 생활권, 지인 소개, 일과 연결된 자리, 취향이 드러나는 공간에서 인연이 열리기 쉽습니다. 첫 만남에서는 직업보다 시간 약속, 대화 균형, 돈 쓰는 태도를 보세요.',
        open: true
      }
    ]
  };

  return {
    ...report,
    title: '연애운 프리미엄 리포트',
    subtitle: '감정선, 연락 온도, 인연 루트, 오래 가는 관계 조건을 전용 목차로 정리한 연애 리포트',
    badge: '연애 감정서',
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 연애운 핵심 결론`,
      analysis: [
        `${report.customerName}님의 연애운은 “누가 나를 좋아하느냐”보다 “나는 어떤 관계에서 편안하고 어떤 관계에서 소모되는가”를 먼저 봐야 합니다.`,
        `일간 ${report.dayMaster}, ${report.strengthLabel}, ${report.currentDayun.name} 대운을 함께 보면 감정의 크기보다 생활에서 신뢰가 반복되는지가 더 중요합니다.`,
        '상대의 말보다 약속, 연락 온도, 돈과 시간의 태도, 갈등 후 회복 방식을 보세요. 이 네 가지가 맞으면 관계는 천천히 깊어지고, 맞지 않으면 설렘이 있어도 피로가 먼저 쌓입니다.'
      ],
      advice: [
        '호감이 있으면 긴 설명보다 짧은 표현을 늦추지 마세요.',
        '연락 빈도보다 약속을 지키는 태도를 먼저 보세요.',
        '불안해서 확인하려는 날에는 메시지를 길게 보내지 말고 질문 하나만 남기세요.'
      ]
    },
    keyTakeaways: [
      { title: '연애 핵심', body: '오래 가는 인연은 설렘보다 생활 장면에서 편안한 사람입니다.', tone: 'good' },
      { title: '연락', body: '답장을 기다리며 혼자 결론내기보다 짧고 분명하게 확인하는 편이 좋습니다.' },
      { title: '인연', body: '반복적으로 마주치는 생활권, 지인 소개, 일과 연결된 자리에서 열리기 쉽습니다.' },
      { title: '주의', body: '애매한 사람에게 오래 맞추면 감정 체력이 먼저 소모됩니다.', tone: 'warn' }
    ],
    questionAnswers: buildProductQuestionAnswers(
      report,
      '연애운',
      '연애운에서는 상대를 단정하기보다 연락, 약속, 거리감, 갈등 후 회복 방식을 함께 보아야 합니다.'
    ),
    sections: compactSections([
      loveCore,
      getSection(report, 'love'),
      getSection(report, 'relationship-pattern'),
      loveTiming,
      getSection(report, 'yongsin'),
      buildMonthStageSection(report, '연애운 월별 행동 전략'),
      getSection(report, 'expert-check')
    ]),
    actionPlan: {
      ...report.actionPlan,
      title: '연애운 30일 행동 가이드',
      priorities: [
        '1주차: 내가 불안해지는 연락 패턴과 편안해지는 연락 패턴을 나눠 적습니다.',
        '2주차: 호감이 있는 사람에게 긴 설명 대신 짧은 제안을 해봅니다.',
        '3주차: 약속, 돈, 시간, 갈등 후 태도를 관찰합니다.',
        '4주차: 나를 불안하게 만드는 관계와 편안하게 만드는 관계를 분리합니다.'
      ]
    }
  };
}

function buildReunionProductReport(report: SajuReportData): SajuReportData {
  const reunionCore: ReportSection = {
    id: 'reunion-core',
    title: '재회운 핵심 진단',
    subtitle: '미련인지 가능성인지, 다시 연락해도 되는 조건을 먼저 봅니다.',
    callout: {
      title: '재회는 가능성보다 조건입니다',
      body: `${report.customerName}님의 재회운은 감정이 남았는지보다 같은 문제가 반복되지 않을 조건이 생겼는지를 봐야 합니다. 연락 타이밍보다 중요한 것은 상대가 다시 대화할 준비가 되었는지, 내가 같은 방식으로 흔들리지 않을 수 있는지입니다.`
    },
    cards: [
      {
        title: '남은 감정',
        body: '감정이 남아 있어도 바로 재회로 이어진다고 볼 수는 없습니다. 남은 감정이 대화로 바뀌는지, 원망으로 남는지가 중요합니다.'
      },
      {
        title: '연락하기 좋은 조건',
        body: '상대가 방어적으로 닫혀 있지 않고, 내가 긴 설명보다 짧은 안부와 사실 확인을 할 수 있을 때가 더 안전합니다.',
        tone: 'good'
      },
      {
        title: '멈춰야 할 신호',
        body: '상대 반응을 확인하려고 몰아붙이거나, 불안해서 연속 메시지를 보내고 싶어질 때는 아직 타이밍이 아닙니다.',
        tone: 'warn'
      },
      {
        title: '첫 연락 원칙',
        body: '사과, 원망, 재회 요구를 한 번에 넣지 말고 안부와 짧은 확인 하나만 남기는 편이 좋습니다.'
      }
    ]
  };

  const reunionTimeline: ReportSection = {
    id: 'reunion-timeline',
    title: '재접촉 타이밍',
    subtitle: '정확한 날짜 단정보다 접촉하기 쉬운 구간과 피해야 할 구간을 나눕니다.',
    details: report.monthLuck.slice(0, 6).map((item, index) => ({
      summary: `${item.year}.${String(item.month).padStart(2, '0')} · ${getLuckPhase(item.score)}`,
      content: `${item.summary}\n\n재회 적용: ${item.score >= 75 ? '짧은 안부나 가벼운 접점을 열어볼 수 있는 구간입니다.' : item.score < 55 ? '감정 확인보다 정리와 회복이 먼저인 구간입니다.' : '상대 반응을 보되 결론을 서두르지 않는 구간입니다.'}\n\n주의: ${item.warning}`,
      open: index < 2
    }))
  };

  return {
    ...report,
    title: '재회운 프리미엄 리포트',
    subtitle: '남은 감정, 재접촉 조건, 멈춰야 할 신호를 현실적으로 정리한 재회 리포트',
    badge: '재회 감정서',
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 재회운 핵심 결론`,
      analysis: [
        '재회운은 “다시 만난다/못 만난다”로 단정하면 위험합니다. 지금은 감정의 잔량보다 같은 문제가 반복되지 않을 조건이 만들어졌는지가 핵심입니다.',
        `${report.currentDayun.name} 대운에서는 관계의 양과 책임이 함께 움직일 수 있어, 재접촉은 감정보다 거리 조절이 먼저입니다.`,
        '상대가 어떤 마음인지보다 내가 어떤 방식으로 연락하면 관계를 더 망치지 않는지를 보는 것이 현실적입니다.'
      ],
      advice: [
        '첫 연락은 짧게, 요구 없이, 상대가 답할 여지를 남기세요.',
        '불안해서 여러 번 보내고 싶어지는 날에는 보내지 않는 편이 낫습니다.',
        '재회 가능성보다 재회 후 반복될 문제를 먼저 점검하세요.'
      ]
    },
    keyTakeaways: [
      { title: '재회 핵심', body: '감정이 남았는지보다 같은 문제가 반복되지 않을 조건이 생겼는지가 중요합니다.', tone: 'good' },
      { title: '연락', body: '긴 설명보다 안부와 짧은 확인 하나가 더 안전합니다.' },
      { title: '주의', body: '상대 반응을 확인하려고 몰아붙이는 순간 흐름이 무거워집니다.', tone: 'warn' },
      { title: '정리', body: '재회가 어렵더라도 이번 관계에서 반복된 패턴을 알면 다음 관계의 손실이 줄어듭니다.' }
    ],
    questionAnswers: buildProductQuestionAnswers(
      report,
      '재회운',
      '재회운에서는 감정의 크기보다 재접촉 조건, 상대의 방어감, 다시 반복될 문제를 함께 보아야 합니다.'
    ),
    sections: compactSections([
      reunionCore,
      reunionTimeline,
      getSection(report, 'relationship-pattern'),
      getSection(report, 'love'),
      getSection(report, 'event-timeline'),
      getSection(report, 'expert-check')
    ]),
    actionPlan: {
      ...report.actionPlan,
      title: '재회운 30일 거리 조절표',
      priorities: [
        '1주차: 연락하고 싶은 이유가 그리움인지 불안인지 구분합니다.',
        '2주차: 상대에게 요구하지 않는 짧은 문장을 준비합니다.',
        '3주차: 답이 오지 않아도 추가 메시지를 보내지 않는 연습을 합니다.',
        '4주차: 재회 후 반복될 문제와 바뀐 조건을 적어봅니다.'
      ]
    }
  };
}

function buildMarriageProductReport(report: SajuReportData): SajuReportData {
  const isTiming = report.serviceId === 'marriage-timing';
  const marriageCore: ReportSection = {
    id: 'marriage-core',
    title: isTiming ? '혼인 시기 핵심 진단' : '결혼운 핵심 진단',
    subtitle: '결혼 가능성보다 생활이 유지되는 조건을 먼저 봅니다.',
    callout: {
      title: '결혼은 감정과 생활의 합입니다',
      body: `${report.customerName}님의 결혼운은 설렘만으로 보지 않습니다. 돈을 쓰고 모으는 기준, 가족과의 거리, 일의 우선순위, 갈등 후 회복 방식이 맞아야 결혼 안정감이 올라갑니다.`
    },
    cards: [
      {
        title: '배우자상',
        body: '말이 화려한 사람보다 약속, 돈, 시간, 가족 경계가 일정한 사람이 더 안정적입니다.',
        tone: 'good'
      },
      {
        title: '결혼을 흔드는 변수',
        body: '감정은 좋은데 돈 이야기, 가족 거리, 역할 분담을 피하면 결혼 후 피로가 커질 수 있습니다.',
        tone: 'warn'
      },
      {
        title: '확인해야 할 질문',
        body: '어디서 살지, 돈을 어떻게 모을지, 가족과 어느 정도 거리를 둘지, 다툰 뒤 어떻게 화해할지 물어보세요.'
      },
      {
        title: '혼인 적기',
        body: '좋은 시기는 “날짜”보다 둘의 생활 기준이 맞고 주변 현실이 받쳐주는 구간으로 봐야 합니다.'
      }
    ]
  };

  const marriageTimeline: ReportSection = {
    id: 'marriage-timeline',
    title: isTiming ? '혼인 적기 타임라인' : '결혼운 타임라인',
    subtitle: '결혼 이야기를 꺼내기 좋은 구간과 결론을 서두르지 말아야 할 구간',
    cards: report.yearLuck.slice(0, 5).map((item) => ({
      title: `${item.year}년 · ${getLuckPhase(item.score)}`,
      body: `${item.headline}. 결혼운에서는 ${item.focus}가 생활 조건으로 드러날 수 있습니다. ${item.warning}`,
      tone: item.score >= 80 ? 'good' : item.score < 55 ? 'warn' : undefined
    }))
  };

  return {
    ...report,
    title: isTiming ? '혼인 시기 프리미엄 리포트' : '결혼운 프리미엄 리포트',
    subtitle: isTiming
      ? '혼인을 서두를 때와 기다릴 때를 현실 조건으로 나누어 보는 타이밍 리포트'
      : '배우자상, 결혼 안정감, 현실 조건, 결혼 후 생활 결을 함께 읽는 결혼운 리포트',
    badge: isTiming ? '혼인 적기 감정서' : '결혼 감정서',
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 ${isTiming ? '혼인 시기' : '결혼운'} 핵심 결론`,
      analysis: [
        '결혼운은 “언제 결혼한다”로 단정하는 상품이 아니라, 어떤 조건이 맞을 때 안정적으로 결혼 이야기가 현실화되는지 보는 리포트입니다.',
        `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 함께 보면, 결혼은 감정의 크기보다 돈, 시간, 가족, 역할 분담의 기준이 맞을 때 안정됩니다.`,
        '상대가 좋은 사람인지보다 함께 생활을 운영할 수 있는 사람인지 확인해야 만족도가 높습니다.'
      ],
      advice: [
        '결혼 이야기는 감정이 좋을 때보다 돈, 주거, 가족 거리 이야기를 차분히 할 수 있을 때 꺼내세요.',
        '상대의 말보다 반복 행동과 책임지는 태도를 보세요.',
        '결혼을 서두르고 싶을수록 현실 체크리스트를 먼저 채우세요.'
      ]
    },
    keyTakeaways: [
      { title: '결혼 핵심', body: '결혼은 설렘보다 생활 기준이 맞을 때 안정됩니다.', tone: 'good' },
      { title: '배우자', body: '돈, 시간, 가족 거리, 갈등 회복 방식이 일정한 사람이 잘 맞습니다.' },
      { title: '주의', body: '불안 때문에 결정을 앞당기면 이후 조율 비용이 커질 수 있습니다.', tone: 'warn' },
      { title: '시기', body: '혼인 적기는 날짜보다 둘의 현실 조건이 맞는 구간으로 봐야 합니다.' }
    ],
    questionAnswers: buildProductQuestionAnswers(
      report,
      isTiming ? '혼인 시기' : '결혼운',
      '결혼운에서는 호감보다 돈, 주거, 가족 거리, 역할 분담 같은 현실 조건을 함께 확인해야 합니다.'
    ),
    sections: compactSections([
      marriageCore,
      marriageTimeline,
      getSection(report, 'love'),
      getSection(report, 'relationship-pattern'),
      getSection(report, 'yongsin'),
      buildMonthStageSection(report, isTiming ? '혼인 시기 월별 전략' : '결혼운 월별 전략'),
      getSection(report, 'expert-check')
    ]),
    actionPlan: {
      ...report.actionPlan,
      title: isTiming ? '혼인 시기 30일 체크리스트' : '결혼운 30일 준비표',
      priorities: [
        '1주차: 돈, 주거, 가족 거리, 일의 우선순위를 각각 적습니다.',
        '2주차: 상대와 현실 주제 하나를 차분히 이야기합니다.',
        '3주차: 갈등이 생겼을 때 회복 방식이 맞는지 봅니다.',
        '4주차: 결혼을 앞당길 조건과 기다려야 할 조건을 나눕니다.'
      ]
    }
  };
}

function buildCompatibilityProductReport(report: SajuReportData): SajuReportData {
  const isDestiny = report.serviceId === 'match-destiny';
  const compatibilityCore: ReportSection = {
    id: 'compatibility-core',
    title: isDestiny ? '운명 궁합 핵심 진단' : '사주궁합 핵심 진단',
    subtitle: '좋다/나쁘다보다 왜 끌리고 어디서 부딪히는지 봅니다.',
    callout: {
      title: '궁합은 점수가 아니라 운영 방식입니다',
      body: `${report.customerName}님의 궁합 리포트는 상대를 단정하지 않고, 두 사람이 감정 속도와 생활 기준을 어떻게 맞출 수 있는지 보는 방식으로 구성됩니다.`
    },
    cards: [
      {
        title: '끌림 포인트',
        body: '서로 다른 기질이 자극이 될 수 있지만, 그 차이가 생활에서 피로가 되는지까지 함께 봐야 합니다.',
        tone: 'good'
      },
      {
        title: '갈등 포인트',
        body: '연락 속도, 돈 쓰는 기준, 가족과 일의 우선순위가 다르면 감정이 좋아도 자주 부딪힐 수 있습니다.',
        tone: 'warn'
      },
      {
        title: '생활 궁합',
        body: '함께 있을 때 편한지보다 바쁠 때 서로를 어떻게 배려하는지가 장기 궁합의 핵심입니다.'
      },
      {
        title: '관계 운영법',
        body: '싸우지 않는 관계보다 다툰 뒤 다시 맞추는 방식이 있는 관계가 오래 갑니다.'
      }
    ]
  };

  const compatibilityTimeline: ReportSection = {
    id: 'compatibility-timeline',
    title: '관계 흐름 타임라인',
    subtitle: '관계가 가까워지는 시기와 거리 조절이 필요한 시기',
    details: report.monthLuck.slice(0, 8).map((item, index) => ({
      summary: `${item.year}.${String(item.month).padStart(2, '0')} · ${getLuckPhase(item.score)}`,
      content: `${item.summary}\n\n궁합 적용: ${item.score >= 75 ? '관계의 다음 단계를 이야기하기 좋은 구간입니다.' : item.score < 55 ? '상대 반응을 밀어붙이기보다 거리와 체력을 조절해야 하는 구간입니다.' : '서로의 조건을 확인하기 좋은 구간입니다.'}\n\n주의: ${item.warning}`,
      open: index < 2
    }))
  };

  return {
    ...report,
    title: isDestiny ? '운명 궁합 프리미엄 리포트' : '사주궁합 프리미엄 리포트',
    subtitle: isDestiny
      ? '이 인연의 무게감, 장기 가능성, 현실 안정성을 함께 보는 운명형 궁합 리포트'
      : '끌림, 감정 속도, 생활 리듬, 갈등 포인트를 함께 보는 대표 궁합 리포트',
    badge: isDestiny ? '운명 궁합 감정서' : '사주궁합 감정서',
    summary: {
      ...report.summary,
      title: `${report.customerName}님의 ${isDestiny ? '운명 궁합' : '사주궁합'} 핵심 결론`,
      analysis: [
        '궁합은 좋은 점수 하나로 끝나는 영역이 아닙니다. 왜 끌리는지, 어디서 반복적으로 부딪히는지, 생활 기준을 맞출 수 있는지가 더 중요합니다.',
        `${report.dayMaster} 일간과 ${report.currentDayun.name} 대운을 기준으로 보면, 관계는 감정의 크기보다 반복 행동과 책임 태도에서 안정성이 갈립니다.`,
        isDestiny
          ? '운명형 궁합에서는 이 사람이 오래 갈 인연인지, 강하게 스쳐 지나가며 나를 바꾸는 인연인지까지 함께 봐야 합니다.'
          : '대표 궁합에서는 끌림과 갈등을 동시에 보고, 실제로 관계를 운영할 방법까지 정리해야 만족도가 올라갑니다.'
      ],
      advice: [
        '상대의 말보다 반복 행동, 약속, 돈, 시간 태도를 보세요.',
        '갈등이 없는지보다 갈등 뒤에 다시 맞추는 방식이 있는지 확인하세요.',
        '궁합은 결론보다 운영법으로 써야 관계가 좋아집니다.'
      ]
    },
    keyTakeaways: [
      { title: '궁합 핵심', body: '끌림은 시작이고, 생활 기준은 지속입니다.', tone: 'good' },
      { title: '강점', body: '서로 다른 기질이 자극과 성장의 계기가 될 수 있습니다.' },
      { title: '주의', body: '연락, 돈, 시간, 가족 거리 기준이 어긋나면 감정이 좋아도 피로가 쌓입니다.', tone: 'warn' },
      { title: '운영법', body: '다투지 않는 관계보다 다툰 뒤 회복 방법이 있는 관계가 오래 갑니다.' }
    ],
    questionAnswers: buildProductQuestionAnswers(
      report,
      isDestiny ? '운명 궁합' : '사주궁합',
      '궁합에서는 좋다/나쁘다보다 끌림, 갈등, 생활 리듬, 회복 방식을 함께 보아야 합니다.'
    ),
    sections: compactSections([
      compatibilityCore,
      getSection(report, 'relationship-pattern'),
      compatibilityTimeline,
      getSection(report, 'love'),
      getSection(report, 'myeongri-basis'),
      getSection(report, 'expert-check')
    ]),
    actionPlan: {
      ...report.actionPlan,
      title: isDestiny ? '운명 궁합 30일 관계 점검표' : '사주궁합 30일 운영 가이드',
      priorities: [
        '1주차: 상대와 내가 불편해지는 장면을 각각 적습니다.',
        '2주차: 연락, 돈, 시간, 가족 거리 기준을 비교합니다.',
        '3주차: 갈등 후 회복 방식이 맞는지 확인합니다.',
        '4주차: 맞추기 어려운 부분과 맞출 수 있는 부분을 나눕니다.'
      ]
    }
  };
}

function buildProductFocusedReport(report: SajuReportData): SajuReportData {
  if (report.serviceId === 'concern-reading') {
    return report;
  }

  if (report.serviceId === 'life-flow') {
    return buildLifeFlowProductReport(report);
  }

  if (report.serviceId === 'love-reading') {
    return buildLoveProductReport(report);
  }

  if (report.serviceId === 'love-reunion') {
    return buildReunionProductReport(report);
  }

  if (report.kind === 'marriage') {
    return buildMarriageProductReport(report);
  }

  if (report.kind === 'compatibility') {
    return buildCompatibilityProductReport(report);
  }

  return {
    ...report,
    title: '종합사주 프리미엄 리포트',
    sections: report.sections.map((section) => (section.id === 'month' ? buildMonthStageSection(report) : section))
  };
}

function preserveGeneratedQuestionAnswers(report: SajuReportData, source: SajuReportData): SajuReportData {
  const generatedAnswers = source.questionAnswers.filter(
    (answer) => answer.question?.trim() && answer.analysis?.trim() && answer.advice?.length
  );

  if (generatedAnswers.length === 0) {
    return report;
  }

  return {
    ...report,
    questionAnswers: generatedAnswers,
    sections: report.sections.map((section) => {
      if (!['concern-custom', 'focused-questions'].includes(section.id)) {
        return section;
      }

      return {
        ...section,
        details: generatedAnswers.map((answer, index) => ({
          summary: answer.title || `질문 ${index + 1}`,
          content: `${answer.analysis}\n\n${answer.advice.join('\n')}`,
          open: true
        }))
      };
    })
  };
}

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { formData, paymentMethod, orderId, reportAccessToken, reportData } = (location.state as ReportLocationState) || {};
  const service = findServiceById(id);
  const hasReportSource = Boolean(reportData || formData?.birthDate);
  const isLiveHost = typeof window !== 'undefined' && /(^|\.)unwoldang\.com$/i.test(window.location.hostname);
  const shouldBlockPreview = isLiveHost && (!hasReportSource || (!reportData && !reportAccessToken));
  const reportInput = formData?.birthDate ? formData : PREVIEW_FORM_DATA;
  const reportCharacterVideo = reportInput.gender === 'female' ? '/report-character-female.mp4' : '/report-character-male.mp4';
  const baseReport = useMemo(() => reportData || buildSajuReport(service.id, reportInput), [reportInput, reportData, service.id]);
  const report = useMemo(() => {
    const preserveAiQuestions = Boolean(reportData);
    const expandedReport = buildExpandedCoreReport(baseReport);
    let nextReport: SajuReportData;

    if (expandedReport.serviceId === 'concern-reading') {
      nextReport = buildConcernReadingReportV2(expandedReport, { preserveQuestionAnswers: preserveAiQuestions });
      return preserveAiQuestions ? preserveGeneratedQuestionAnswers(nextReport, baseReport) : nextReport;
    }

    if (expandedReport.serviceId === 'life-flow') {
      nextReport = buildProductFocusedReport(buildYearlyFortuneReportV2(expandedReport));
      return preserveAiQuestions ? preserveGeneratedQuestionAnswers(nextReport, baseReport) : nextReport;
    }

    if (['love', 'reunion', 'marriage', 'career', 'wealth'].includes(expandedReport.kind)) {
      nextReport = buildProductFocusedReport(buildFocusedPremiumReport(expandedReport));
      return preserveAiQuestions ? preserveGeneratedQuestionAnswers(nextReport, baseReport) : nextReport;
    }

    nextReport = buildProductFocusedReport(
      buildExpertSatisfactionReport(expandedReport, { preserveQuestionAnswers: preserveAiQuestions })
    );
    return preserveAiQuestions ? preserveGeneratedQuestionAnswers(nextReport, baseReport) : nextReport;
  }, [baseReport, reportData]);
  const isYearlyShowcase = report.serviceId === 'life-flow';
  const pageCopy = getReportPageCopy(report);
  const yearlyLead = report.yearLuck[0];
  const yearlyMomentum = report.yearLuck.slice(0, 3);
  const monthlyHotMonths = [...report.monthLuck].sort((left, right) => right.score - left.score).slice(0, 3);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [htmlDownloadMessage, setHtmlDownloadMessage] = useState('');
  const [htmlDownloadUrl, setHtmlDownloadUrl] = useState('');
  const [htmlDownloadFileName, setHtmlDownloadFileName] = useState('');
  const [isReportVideoMuted, setIsReportVideoMuted] = useState(true);
  const reportVideoRef = useRef<HTMLVideoElement>(null);
  const htmlDownloadUrlRef = useRef('');

  useEffect(() => {
    if (shouldBlockPreview) {
      return;
    }

    document.title = '운월당 리포트';
  }, [shouldBlockPreview]);

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

  useEffect(
    () => () => {
      if (htmlDownloadUrlRef.current) {
        URL.revokeObjectURL(htmlDownloadUrlRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const video = reportVideoRef.current;

    if (!video) {
      return;
    }

    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;
    setIsReportVideoMuted(true);

    const playMutedVideo = async () => {
      try {
        await video.play();
      } catch {
        // Mobile browsers may wait for the next ready event, so the video handlers try again.
      }
    };

    void playMutedVideo();
  }, [reportCharacterVideo]);

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
    ...(report.serviceId === 'concern-reading' ? [{ id: 'answer-first', label: '고민 결론 먼저', number: '00' }] : []),
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

  const forceMuteReportVideo = () => {
    const video = reportVideoRef.current;

    if (!video) {
      return;
    }

    video.defaultMuted = true;
    video.muted = true;
    video.volume = 0;
    setIsReportVideoMuted(true);
  };

  const handleToggleReportVideoAudio = async () => {
    const video = reportVideoRef.current;

    if (!video) {
      return;
    }

    const nextMuted = !video.muted ? true : false;

    video.defaultMuted = nextMuted;
    video.muted = nextMuted;
    video.volume = nextMuted ? 0 : 0.48;
    setIsReportVideoMuted(nextMuted);

    if (!nextMuted) {
      try {
        await video.play();
      } catch {
        setHtmlDownloadMessage('브라우저가 소리 재생을 막았어요. 영상 버튼을 한 번 더 눌러주세요.');
        window.setTimeout(() => setHtmlDownloadMessage(''), 2800);
      }
    }
  };

  const handleDownloadHtmlReport = async () => {
    try {
      const reportPaper = document.querySelector<HTMLElement>('.premium-report-paper');

      if (!reportPaper) {
        setHtmlDownloadMessage('리포트 본문을 찾지 못했어요. 페이지를 새로고침한 뒤 다시 눌러주세요.');
        window.setTimeout(() => setHtmlDownloadMessage(''), 3200);
        return;
      }

      const clonedPaper = reportPaper.cloneNode(true) as HTMLElement;

      clonedPaper.querySelectorAll('[data-export-remove="true"]').forEach((element) => {
        element.remove();
      });

      const fileBaseName = createSafeReportFileName(`운월당-${report.serviceId}-리포트`);
      const pageClassName = isYearlyShowcase ? 'premium-report-page yearly-premium-page export-html-page' : 'premium-report-page export-html-page';
      const shellClassName = isYearlyShowcase ? 'premium-report-shell yearly-report-shell export-html-shell' : 'premium-report-shell export-html-shell';
      const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>운월당 리포트</title>
  <style>
${getCurrentPageCssText()}

body {
  margin: 0;
}

.export-html-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(138, 114, 88, 0.18);
  background: rgba(255, 252, 246, 0.94);
  color: #2a2520;
  font-family: inherit;
  backdrop-filter: blur(14px);
}

.export-html-topbar strong {
  font-size: 14px;
  font-weight: 900;
}

.export-html-topbar span {
  color: #756b5e;
  font-size: 12px;
  font-weight: 700;
}

@media print {
  .export-html-topbar {
    display: none !important;
  }
}
  </style>
</head>
<body>
  <div class="export-html-topbar">
    <strong>운월당 리포트</strong>
  </div>
  <main class="${pageClassName}">
    <div class="${shellClassName}">
      ${clonedPaper.outerHTML}
    </div>
  </main>
  <script>
    document.querySelectorAll('[data-export-target]').forEach(function(button) {
      button.addEventListener('click', function() {
        var targetId = button.getAttribute('data-export-target');
        var target = targetId ? document.getElementById(targetId) : null;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  </script>
</body>
</html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const downloadFileName = `${fileBaseName}.html`;
      const reportFile =
        typeof File !== 'undefined' ? new File([blob], downloadFileName, { type: 'text/html;charset=utf-8' }) : null;

      if (htmlDownloadUrlRef.current) {
        URL.revokeObjectURL(htmlDownloadUrlRef.current);
      }

      const filePicker = (
        window as unknown as {
          showSaveFilePicker?: (options: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (data: Blob) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }
      ).showSaveFilePicker;

      if (filePicker && !isMobileDownloadBrowser()) {
        try {
          const fileHandle = await filePicker({
            suggestedName: downloadFileName,
            types: [
              {
                description: 'HTML 리포트',
                accept: {
                  'text/html': ['.html']
                }
              }
            ]
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          setHtmlDownloadUrl('');
          setHtmlDownloadFileName(downloadFileName);
          setHtmlDownloadMessage(`HTML 파일을 저장했어요: ${downloadFileName}`);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setHtmlDownloadMessage('저장이 취소됐어요. 다시 누르면 HTML 파일로 저장할 수 있습니다.');
            window.setTimeout(() => setHtmlDownloadMessage(''), 3200);
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);

      htmlDownloadUrlRef.current = url;
      setHtmlDownloadUrl(url);
      setHtmlDownloadFileName(downloadFileName);

      if (
        reportFile &&
        isMobileDownloadBrowser() &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [reportFile] })
      ) {
        try {
          await navigator.share({
            files: [reportFile],
            title: '운월당 리포트',
            text: '운월당 HTML 리포트입니다.'
          });
          setHtmlDownloadMessage(`HTML 파일 저장/공유창을 열었어요: ${downloadFileName}`);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setHtmlDownloadMessage('저장/공유가 취소됐어요. 아래 “다운로드 다시 시도”를 눌러 다시 받을 수 있습니다.');
            window.setTimeout(() => setHtmlDownloadMessage(''), 4200);
            return;
          }
        }
      }

      const link = document.createElement('a');

      link.href = url;
      link.download = downloadFileName;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.position = 'fixed';
      link.style.left = '-9999px';
      link.style.top = '0';
      link.style.width = '1px';
      link.style.height = '1px';
      link.style.opacity = '0';
      document.body.appendChild(link);
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      window.setTimeout(() => link.remove(), 1000);

      setHtmlDownloadMessage(
        'HTML 다운로드를 요청했어요. 모바일에서 저장창이 안 뜨면 아래 “다운로드 다시 시도” 또는 “HTML 바로 보기”를 눌러주세요.'
      );
    } catch {
      setHtmlDownloadMessage('HTML 파일 생성 중 오류가 났어요. 페이지를 새로고침한 뒤 다시 눌러주세요.');
      window.setTimeout(() => setHtmlDownloadMessage(''), 4200);
    }
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
          {isYearlyShowcase && yearlyLead ? (
            <section className="premium-report-cover yearly-report-cover">
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
            </section>
          ) : null}

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
                          <span>
                            {getLuckPhase(item.score)} · {getBestMonthReason(item)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p>
                      {monthlyHotMonths[0]
                        ? `순서는 월운 점수와 사건성을 함께 본 결과입니다. ${formatBestMonthReasonList(monthlyHotMonths)}으로 읽습니다. ${monthlyHotMonths[0].year}.${String(monthlyHotMonths[0].month).padStart(2, '0')}은 움직임을 가장 먼저 열어보기 좋은 구간입니다.`
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

          {report.serviceId === 'general-signature' || report.serviceId === 'concern-reading' ? (
            <section className="premium-report-character" aria-label="운월당 사주 리포트 캐릭터">
              <video
                ref={reportVideoRef}
                className="premium-report-character-video"
                src={reportCharacterVideo}
                autoPlay
                muted={isReportVideoMuted}
                loop
                playsInline
                preload="auto"
                onLoadedMetadata={forceMuteReportVideo}
                onLoadedData={() => {
                  void reportVideoRef.current?.play().catch(() => undefined);
                }}
                onCanPlay={() => {
                  void reportVideoRef.current?.play().catch(() => undefined);
                }}
                onClick={() => {
                  if (!isReportVideoMuted) {
                    forceMuteReportVideo();
                  }
                }}
              />
              <div className="premium-report-character-glow" aria-hidden="true" />
              <button
                type="button"
                className="premium-report-video-audio-button"
                onClick={handleToggleReportVideoAudio}
                aria-label={isReportVideoMuted ? '영상 소리 켜기' : '영상 소리 끄기'}
                data-export-remove="true"
              >
                {isReportVideoMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                <span>{isReportVideoMuted ? '소리 켜기' : '소리 끄기'}</span>
              </button>
            </section>
          ) : null}

          {report.serviceId === 'concern-reading' ? (
            <>
              <ConcernAnswerSpotlight report={report} />
              <div className="premium-divider" />
            </>
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
                <strong>{pageCopy.tocTitle}</strong>
                <em>필요한 부분만 빠르게 이동할 수 있습니다.</em>
              </div>
              <span className="premium-toc-arrow" aria-hidden="true">
                &gt;
              </span>
            </button>

            {isTocOpen ? (
              <div className="premium-toc">
                {tocItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="premium-toc-item"
                    data-export-target={item.id}
                    onClick={() => scrollToSection(item.id)}
                  >
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
                <p className="premium-muted">{pageCopy.summaryCaption}</p>
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
                <h2>{pageCopy.qaTitle}</h2>
                <p className="premium-muted">{pageCopy.qaCaption}</p>
              </div>
            </div>

            {report.questionAnswers.length ? (
              report.questionAnswers.map((qa, index) => (
                report.serviceId === 'concern-reading' ? (
                  <ConcernQuestionAnswerCard key={`${qa.question}-${index}`} qa={qa} index={index} report={report} />
                ) : (
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
                )
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
                <h2>{pageCopy.glanceTitle}</h2>
                <p className="premium-muted">{pageCopy.glanceCaption}</p>
              </div>
            </div>

            <SajuWonGukBoard report={report} />
            <SajuWonGukReading report={report} />

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
              <div className="premium-report-support-actions">
                <a href={issueMailHref} className="app-black-button">
                  오타·불일치 신고
                </a>
                <button type="button" className="premium-html-download-button" onClick={handleDownloadHtmlReport} data-export-remove="true">
                  <Download size={16} />
                  HTML 다운로드
                </button>
                {htmlDownloadUrl ? (
                  <>
                    <a
                      href={htmlDownloadUrl}
                      download={htmlDownloadFileName || undefined}
                      rel="noopener"
                      className="premium-html-open-link"
                      aria-label={`${htmlDownloadFileName} 다운로드 다시 시도`}
                      data-export-remove="true"
                    >
                      다운로드 다시 시도
                    </a>
                    <a
                      href={htmlDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="premium-html-open-link"
                      aria-label={`${htmlDownloadFileName} HTML 바로 보기`}
                      data-export-remove="true"
                    >
                      HTML 바로 보기
                    </a>
                  </>
                ) : null}
              </div>
            </div>
            {htmlDownloadMessage ? <p className="premium-html-download-message">{htmlDownloadMessage}</p> : null}
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
