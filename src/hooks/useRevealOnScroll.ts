import { useLayoutEffect, type RefObject } from 'react';

/**
 * [data-reveal] 이 붙은 요소를 한 번만 켜 주는 단일 IntersectionObserver.
 *
 * 규칙:
 * - observer 는 페이지당 1개. 패널마다 따로 만들지 않는다.
 * - data-reveal 은 패널 루트에만 붙인다. 내부 요소는 .is-visible 후손 선택자로 구동한다.
 *   (content-visibility:auto 서브트리 안의 자식은 관찰이 지연될 수 있다.)
 * - 감속 선호 여부로 JS 가 분기하지 않는다. 항상 is-visible 을 붙이고 표현만 CSS 가 정한다.
 *   그래야 어떤 경로로도 콘텐츠가 숨겨진 채 남지 않는다.
 *
 * ★ 숨김의 소유권 — `data-reveal-armed`
 *   리빌 패턴의 초기 상태(opacity:0)는 CSS 에서
 *   `[data-reveal-armed] [data-reveal]:not(.is-visible)` 안에서만 적용된다.
 *   그 표식은 **이 훅만** 붙이고, 훅은 관찰을 실제로 걸 수 있을 때만 붙인다.
 *   따라서 훅이 돌지 않았거나 관찰을 포기한 모든 경로에서 콘텐츠는 최종 상태로 남는다
 *   — 숨김은 구조적으로 '관찰이 살아 있다' 의 결과이지 기본값이 아니다.
 *
 *   표식은 첫 페인트 전에 붙어야 한다(useLayoutEffect). useEffect 로 미루면
 *   콘텐츠가 한 프레임 보였다가 숨고 다시 나타나는 깜빡임이 된다.
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const collect = (scope: ParentNode) =>
      Array.from(scope.querySelectorAll<HTMLElement>('[data-reveal]'));

    const showAll = () => {
      collect(root).forEach((node) => node.classList.add('is-visible'));
    };

    /* 둘 중 하나라도 없으면 관찰 자체가 성립하지 않는다. 루트를 무장하지 않고
       끝낸다 — 지금 있는 컷도, 나중에 마운트되는 컷도 전부 최종 상태로 그려진다. */
    if (!('IntersectionObserver' in window) || !('MutationObserver' in window)) {
      showAll();
      return;
    }

    /* 관찰이 실제로 동작하는지 여부. IntersectionObserver 는 observe() 한 대상마다
       교차 여부와 무관하게 최초 알림을 한 번 보낸다. 그래서 정상 환경에서는
       마운트 직후 프레임에 반드시 true 가 된다. */
    let delivered = false;

    /* 이미 관찰을 건 노드. 같은 노드를 두 번 observe 해도 무해하지만,
       DOM 변동이 잦은 화면에서 불필요한 순회를 막는다. */
    const seen = new WeakSet<HTMLElement>();

    const observer = new IntersectionObserver(
      (entries) => {
        delivered = true;
        entries.forEach((entry) => {
          /* 뷰포트보다 큰 리빌 루트는 threshold 비율을 영원히 못 채운다
             (예: 화면 높이의 3배인 컷은 14% = 화면 42% 를 넘겨야 한다).
             그런 컷은 '화면의 절반 이상을 덮고 있으면' 켠 것으로 본다.
             조건은 켜는 쪽으로만 작동하므로 콘텐츠를 숨길 수 없다. */
          const root = entry.rootBounds;
          const fillsViewport =
            !!root && root.height > 0 && entry.intersectionRect.height >= root.height * 0.5;

          if (!entry.isIntersecting && !fillsViewport) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: [0, 0.14], rootMargin: '0px 0px -10% 0px' }
    );

    const observe = (node: HTMLElement) => {
      if (seen.has(node)) return;
      seen.add(node);
      observer.observe(node);
    };

    collect(root).forEach(observe);

    /* ★ 나중에 마운트되는 리빌 루트.
       CH00 판단 게이트가 뒤집히면 리포트가 컷을 `<details>` 안팎으로 옮겨 다시
       마운트한다. 마운트 시점에 한 번만 querySelectorAll 하던 이전 판은 그 컷들을
       영원히 관찰하지 않았고, 초기 상태가 opacity:0 이라 **유료 리포트 본문이
       화면 안에 들어와도 투명한 채로 남았다**(보류 안내가 '눌러서 펴 보셔도 돼요'
       로 여는 접힌 장이 빈 화면이 되는 경로). 새로 들어온 노드를 관찰 대상에 넣는다. */
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((added) => {
          if (!(added instanceof HTMLElement)) return;
          if (added.hasAttribute('data-reveal')) observe(added);
          collect(added).forEach(observe);
        });
      }
    });
    mutations.observe(root, { childList: true, subtree: true });

    root.setAttribute('data-reveal-armed', '');

    /* 안전망: IntersectionObserver 가 **존재하지만 콜백을 한 번도 주지 않는** 환경이
       실재한다(일부 임베디드 웹뷰 · 확장이 API 를 스텁으로 덮은 탭). 위의
       `in window` 검사는 그 경로를 잡지 못한다.

       최초 알림이 왔는지만 본다(교차했는지는 보지 않는다). 그래서 화면 밖에서
       시작하는 페이지에서도 오발동하지 않고, 관찰이 죽은 경로에서만 모션을
       포기하고 무장을 풀어 전부 최종 상태로 올린다. */
    const failsafe = window.setTimeout(() => {
      if (delivered) return;
      root.removeAttribute('data-reveal-armed');
      showAll();
    }, 1800);

    return () => {
      window.clearTimeout(failsafe);
      observer.disconnect();
      mutations.disconnect();
      root.removeAttribute('data-reveal-armed');
    };
  }, [rootRef]);
}

export default useRevealOnScroll;
