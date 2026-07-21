import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { describe, expect, it } from 'vitest';
import { getProductById } from '../registry';
import MatchCoupleDetail from './Detail';

const product = getProductById('match-couple');

function renderDetail() {
  return renderToStaticMarkup(
    createElement(
      StaticRouter,
      { location: product.routes.detail },
      createElement(MatchCoupleDetail)
    )
  );
}

describe('match-couple dedicated detail', () => {
  it('renders the registered name, price, image, and canonical intake CTA', () => {
    const html = renderDetail();

    expect(product.id).toBe('match-couple');
    expect(product.displayName).toBe('월연도령 사주궁합');
    expect(product.price).toBe(69_000);
    expect(html).toContain(product.displayName);
    expect(html).toContain('69,000원');
    expect(html).toContain(`src="${product.home.image}"`);
    expect(html).toContain(`href="${product.routes.intake}"`);
    expect(html).not.toContain('/form/match-destiny');
  });

  it('explains the complete two-person intake without production sample data', () => {
    const html = renderDetail();

    expect(html).toContain('두 사람 비교형 독립 궁합');
    expect(html).toContain('이름 또는 별칭');
    expect(html).toContain('양력·음력과 윤달');
    expect(html).toContain('출생시간과 출생지역');
    expect(html).toContain('관계 상태와 관계 기간, 주요 갈등, 알고 싶은 점');
    expect(html).toContain('개인 질문 2개');
    expect(html).not.toContain('홍길동');
    expect(html).not.toContain('1990-01-01');
  });

  it('lists both natal evidence and relationship-focused report coverage', () => {
    const html = renderDetail();

    [
      '일간과 오행',
      '십신의 관계 방식',
      '배우자궁의 특징',
      '합·충·형·파·해',
      '끌림과 감정 표현',
      '연락·대화와 갈등 회복',
      '생활 습관',
      '소비·재물 기준',
      '장기 관계의 역할 배치',
      '조심할 말과 행동',
      '관계 유지 규칙',
      '질문 2개 답변과 30일 관계 실험'
    ].forEach((copy) => expect(html).toContain(copy));
  });

  it('states the no-score, unknown-time, and privacy-safe policies', () => {
    const html = renderDetail();

    expect(html).toContain('자의적인 궁합 점수 없음');
    expect(html).toContain('근거 없는 숫자나 무작위 점수를 만들지 않습니다.');
    expect(html).toContain('시주와 시주 의존 항목을 계산에서 제외');
    expect(html).toContain('출생지역 미상은 지역 보정을 적용하지 않았다고 안내');
    expect(html).toContain('질문 원문은 공유용 요약에 기본 노출하지 않습니다.');
    expect(html).toContain('이름 대신 별칭으로 입력');
  });
});
