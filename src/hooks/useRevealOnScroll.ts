import { useEffect, type RefObject } from 'react';

/**
 * [data-reveal] 이 붙은 요소를 한 번만 켜 주는 단일 IntersectionObserver.
 *
 * 규칙:
 * - observer 는 페이지당 1개. 패널마다 따로 만들지 않는다.
 * - data-reveal 은 패널 루트에만 붙인다. 내부 요소는 .is-visible 후손 선택자로 구동한다.
 *   (content-visibility:auto 서브트리 안의 자식은 관찰이 지연될 수 있다.)
 * - 감속 선호 여부로 JS 가 분기하지 않는다. 항상 is-visible 을 붙이고 표현만 CSS 가 정한다.
 *   그래야 어떤 경로로도 콘텐츠가 숨겨진 채 남지 않는다.
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (nodes.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -10% 0px' }
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [rootRef]);
}

export default useRevealOnScroll;
