import { useEffect, type RefObject } from 'react';

/**
 * `[data-parallax]` 요소에 `--ud-scroll`(-1 ~ 1)을 써 주는 단일 스크롤 리스너.
 *
 * `reunion-premium.css` 의 `.ud-float` 가 그 값을 읽어
 * `translate3d(0, calc(var(--ud-scroll) * var(--ud-depth) * -1), 0)` 로만 움직인다.
 * 값이 없으면 0 이므로 이 훅이 실행되지 않아도(JS 실패 · 감속 선호) 레이아웃은 그대로다.
 *
 * 규칙:
 * - 리스너는 페이지당 1개. rAF 로 프레임을 합친다.
 * - 값은 **컷 루트**에 쓴다. 커스텀 프로퍼티는 상속되므로 컷 안의 아트가 그대로 읽는다.
 *   컷은 `content-visibility: auto` 라 서브트리가 건너뛰어질 수 있어서, 안쪽 요소를
 *   직접 측정하면 화면 밖에서 0 이 나온다. 컷 자신은 항상 박스를 갖는다.
 * - 감속 선호에서는 리스너를 아예 붙이지 않는다. CSS 가 `.ud-float` 를 이미
 *   `transform: none` 으로 고정하므로 스크롤마다 값을 쓰는 것은 순수 낭비다.
 *   (리빌과 달리 콘텐츠가 숨겨진 채 남을 위험이 없어 JS 분기가 안전하다.)
 */
export function useReunionParallax(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-parallax]'));
    if (nodes.length === 0) return;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const viewport = window.innerHeight || 1;

      for (const node of nodes) {
        const rect = node.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > viewport) continue;

        const centre = rect.top + rect.height / 2;
        const offset = ((centre - viewport / 2) / viewport) * 2;
        const clamped = Math.max(-1, Math.min(1, offset));

        node.style.setProperty('--ud-scroll', clamped.toFixed(3));
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [rootRef]);
}

export default useReunionParallax;
