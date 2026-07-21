# 상품 모듈 추가·운영 가이드

운월당의 신규 노출, 입력 시작, 결제, 추천, 검색, SEO 색인 여부는 `src/products/manifest.json`의 상품 상태를 단일 원천으로 사용합니다. 상품별 표시·경로·흐름 설정은 `src/products/<product-id>/index.ts`에 둡니다.

## 상태 계약

- `active`: 홈·검색·추천에 노출하며 신규 입력, 결제, 상세 SEO 색인을 허용합니다.
- `draft`: 운영 노출, 신규 입력, 결제, SEO 색인을 모두 막습니다.
- `archived`: 운영 노출, 신규 입력, 결제, SEO 색인을 막지만 기존 주문·권한으로 저장된 리포트 재열람은 허용합니다.
  - 호환성 예외: 과거 결제 entitlement를 서버에서 갱신했지만 formData가 없어 리포트 생성을 재개해야 하는 경우에만, 유효한 orderId와 reportAccessToken으로 입력 복구를 허용합니다. 최종 권한은 서버 토큰 검증으로 결정합니다.

현재 활성 상품은 `general-signature`, `past-life-goblin`, `love-reading`, `love-reunion`, `match-couple`입니다. 나머지 등록 상품은 보관 상태입니다. 보관 전환 시 상품 코드, 이미지, 가격표, 주문 원장, 리포트 저장 키를 삭제하지 않습니다.

## 모듈 구조

각 상품 디렉터리는 `ProductModuleDefinition`을 만족하는 객체 하나를 내보냅니다.

```ts
import type { ProductModuleDefinition } from '../types';

export const exampleProduct = {
  id: 'example-product',
  displayName: '표시 이름',
  price: 49000,
  currency: 'KRW',
  routes: {
    detail: '/detail/example-product',
    intake: '/form/example-product',
    checkout: '/checkout',
    loading: '/loading',
    report: '/report/example-product'
  },
  discovery: {
    title: '검색·추천 제목',
    summary: '상품 요약',
    category: 'general',
    featured: false
  },
  search: {
    title: '검색 결과 제목',
    image: '/example-card.png',
    keywords: ['검색어']
  },
  home: {
    title: '홈 카드 제목',
    subtitle: '홈 카드 설명',
    image: '/example-card.png',
    category: 'general'
  },
  flow: {
    detailVariant: 'standard',
    intakeVariant: 'standard',
    requiresPartnerBirth: false
  }
} satisfies ProductModuleDefinition;
```

상품별 페이지·adapter·fixture가 더 필요하면 같은 디렉터리 아래에 둡니다. 운영 빌드에 샘플 데이터가 자동 포함되지 않도록 fixture는 테스트에서만 명시적으로 import합니다.

## 새 상품 등록 순서

1. 계약으로 승인된 상품 ID를 `src/products/types.ts`의 `productIds`에 추가합니다.
2. `src/products/<product-id>/index.ts`를 만들고 표시 이름, 숫자 가격, 기존 URL, 검색·홈 메타데이터와 flow adapter를 정의합니다.
3. `src/products/manifest.json`에 먼저 `draft`로 등록합니다.
4. `src/products/registry.ts`에서 모듈을 import하고 ID 매핑에 한 줄을 추가합니다.
5. 기존 리포트 엔진이 필요로 하는 서비스 설명은 `src/api/mockData.ts`에 같은 ID·표시 이름·가격으로 등록합니다. 미등록 ID를 다른 상품으로 대체하지 않습니다.
6. 상세 SEO가 필요하면 `src/content/seoRoutes.json`에 canonical 상세 경로와 `serviceId`, 숫자 `price`, `priceCurrency`를 추가합니다. 생성 스크립트는 manifest가 `active`인 상품만 출력합니다.
7. 서버 가격 계약을 추가하되 클라이언트 가격을 신뢰하지 않습니다. Cloud Run의 신규 주문 발급은 같은 manifest의 `active` 상태를 확인하고, 과거 주문 갱신에 필요한 기존 가격표 항목은 유지합니다.
8. 레지스트리 계약 테스트에 ID·경로·상태·가격 정합성을 추가한 뒤 `draft`에서 `active`로 전환합니다.

## 공용 화면에서 사용하는 selector

- `canDiscoverProduct`: 홈·검색·추천 노출
- `canStartProduct`: 신규 입력 시작
- `canPurchaseProduct`: Checkout과 서버 신규 주문 발급
- `canIndexProduct`: 런타임 SEO와 정적 SEO 생성
- `canReadHistoricalReport`: 기존 주문·보관 리포트 재열람
- `getProductByRoute`: 상세·입력·리포트 URL을 canonical 상품으로 해석

공용 `Home`, `Search`, `Form`, `Checkout`, `Report`에 새 상품 ID 조건문을 직접 추가하지 말고 먼저 상품 모듈의 metadata 또는 flow adapter로 표현합니다.

## 보관 전환 체크리스트

1. manifest 상태만 `archived`로 바꿉니다.
2. 홈·검색·추천·입력·Checkout·SEO·신규 서버 주문이 차단되는지 확인합니다.
3. 기존 주문 ID, 결제 원장, 가격, 리포트 URL과 저장 키를 변경하지 않습니다.
4. 마이페이지에서 기존 archived 리포트가 원래 `serviceId`로 다시 열리는지 확인합니다.
   - formData가 없는 과거 결제 복구는 서버 갱신 entitlement의 유효한 orderId·reportAccessToken으로만 허용하고, 최종 권한은 서버 토큰 검증에 맡깁니다.
5. 상품 코드나 이미지는 별도 삭제 작업으로 넘기지 않습니다.

## 필수 검증

루트에서 다음을 실행합니다.

```text
npm run lint
npm run test
npm run build
```

`cloudrun-api/**`를 수정했다면 다음도 실행합니다.

```text
npm --prefix cloudrun-api run build
```
