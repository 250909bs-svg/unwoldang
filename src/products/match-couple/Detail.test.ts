import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { getProductById } from '../registry';
import MatchCoupleDetail from './Detail';

const product = getProductById('match-couple');
const reportDimensions = [
  '끌림',
  '감정 표현',
  '연락·대화',
  '갈등 회복',
  '생활 습관',
  '소비·재물',
  '장기 관계 역할'
] as const;

function renderDetail() {
  return renderToStaticMarkup(
    createElement(
      StaticRouter,
      { location: product.routes.detail },
      createElement(MatchCoupleDetail)
    )
  );
}

describe('match-couple cinematic detail', () => {
  it('renders the registry-owned name and price with one canonical intake CTA', () => {
    const html = renderDetail();
    const intakeLinks = html.match(new RegExp(`href="${product.routes.intake}"`, 'g')) ?? [];

    expect(product.id).toBe('match-couple');
    expect(product.displayName).toBe('월연도령 사주궁합');
    expect(product.price).toBe(69_000);
    expect(html).toContain(product.displayName);
    expect(html).toContain(`${product.price.toLocaleString('ko-KR')}원`);
    expect(intakeLinks).toHaveLength(1);
    expect(html).not.toContain('/form/match-destiny');
  });

  it('uses the dedicated responsive cover and both webtoon teaser assets', () => {
    const html = renderDetail();

    [
      'couple-cover.avif',
      'couple-cover.webp',
      'couple-friction.avif',
      'couple-friction.webp',
      'couple-ritual.avif',
      'couple-ritual.webp'
    ].forEach((asset) => expect(html).toContain(asset));

    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchpriority="high"');
    expect(html).toContain('match-couple-detail-thread--red');
    expect(html).toContain('match-couple-detail-thread--blue');
    expect(html).toContain('월연도령 · 첫 번째 장면');
    expect(html).toContain('월연도령 · 두 번째 장면');
  });

  it('explains the separate two-person calculation and uncertainty contract before purchase', () => {
    const html = renderDetail();

    expect(html).toContain('두 명식을 따로 세우고');
    expect(html).toContain('PERSON A · 본인');
    expect(html).toContain('PERSON B · 상대방');
    expect(html.match(/일간 · 오행 · 십신 · 배우자궁/g)).toHaveLength(2);
    expect(html).toContain('양력·음력과 윤달');
    expect(html).toContain('출생시간·지역');
    expect(html).toContain('‘미상’으로 남길 수 있고');
    expect(html).toContain('계산하지 못한 항목은 결과에 분명히 표시');
  });

  it('lists the five relations, seven comparison dimensions, two questions, and 30-day experiment', () => {
    const html = renderDetail();

    ['합', '충', '형', '파', '해'].forEach((relation) => {
      expect(html).toContain(`>${relation}</span>`);
    });

    reportDimensions.forEach((dimension) => expect(html).toContain(`>${dimension}</li>`));
    expect(html).toContain('관계 궁합 7차원');
    expect(html).toContain('개인 질문 2개');
    expect(html).toContain('30일 관계 실험');
    expect(html).toContain('조심할 말과 행동');
    expect(html).toContain('관계 유지 규칙');
  });

  it('promises evidence and actions without scores, reviews, or fabricated urgency', () => {
    const html = renderDetail();

    expect(html).toContain('궁합 점수는 만들지 않으며');
    expect(html).toContain('무작위 숫자로 바꾸지 않습니다');
    expect(html).toContain('가짜 할인이나 마감 압박 없이');
    expect(html).not.toMatch(/고객 후기|구매 후기|별점|평점|오늘만|마감 임박/);
    expect(html).not.toContain('1990-01-01');
  });

  it('provides an accessible non-autoplay reading path', () => {
    const html = renderDetail();

    expect(html).toContain('href="#match-couple-teaser"');
    expect(html).toContain('id="match-couple-teaser"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('궁합 리포트 구성으로 바로가기');
    expect(html).toContain('aria-label="두 사람의 개별 계산 항목"');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('autoplay');
  });
});
