# MZ무당 이미지 제작·검수 기록

## 현재 자산 현황

- 소스 PNG: `artwork-source/mz-love-fact/*.png` — 정확히 30장
- 웹 전달 WebP: `public/images/mz-love-fact/generated/*.webp` — 정확히 30장
- 웹 전달 AVIF: `public/images/mz-love-fact/generated/*.avif` — 정확히 30장
- WebP·AVIF 캔버스: 모두 1080×1920
- 소스 PNG는 배포 디렉터리 `public` 밖에 보존한다. `public`에는 최적화본만 둔다.

## 기준 캐릭터

- 기준 파일: `public/home-love-reading-card.png`
- 정체성: 성인 한국인 MZ무당, 긴 검붉은 머리, 붉은 눈, 금빛·붉은 머리 장식, 검정·붉은 현대 한복
- 톤: 프리미엄 한국 게임 시네마틱과 웹툰의 중간, 검정·진홍·금색
- 금지: 캐릭터 얼굴 변경, 미성년 인상, 과도한 노출, 공포·유혈, 읽을 수 없는 생성 텍스트, 로고·워터마크

## 생성 방식

- 모드: 내장 이미지 생성 도구의 이미지 참조 편집
- 기준 이미지를 매 호출에 참조해 얼굴, 의상, 장신구를 고정한다.
- 장면마다 행동·소품·카메라·배경만 변경한다.
- 생성 PNG는 소스 폴더에 보존하고, 최적화 스크립트로 WebP와 AVIF를 별도 생성한다.

공통 프롬프트 요약:

> 기준 이미지와 정확히 같은 성인 한국인 MZ무당. 긴 검붉은 머리, 붉은 눈, 금빛·붉은 장식, 검정·붉은 현대 한복을 유지한다. 프리미엄 웹툰형 한국 게임 시네마틱, 세로 9:16, 텍스트·로고·워터마크 없음, 얼굴·손 왜곡 없음, 과도한 노출과 공포 없음.

## 장면 30종

| 키 | 주요 역할 |
|---|---|
| `hero-fan-closed` | 표지·첫 등장 |
| `whisper-fact` | 가까운 팩폭 대화 |
| `love-self-mirror` | 연애 자화상·거울 |
| `attraction-danger` | 위험한 끌림 경고 |
| `stable-partner-signal` | 안정적인 관계 신호 |
| `final-fact-bomb` | 마지막 조언 |
| `attraction-vs-longevity` | 설렘과 지속 가능성 비교 |
| `future-partner-fan` | 다음 인연의 분위기 |
| `first-meeting-scene` | 일상 속 첫 만남 |
| `waiting-for-message` | 답장·연락 패턴 |
| `room-corridor` | 무당집 진입 복도 |
| `room-consultation` | 상담 공간 |
| `red-thread-knot` | 반복되는 끌림의 매듭 |
| `green-flag-lantern` | 안전한 행동 기준 |
| `red-flag-warning` | 관계 위험 신호 |
| `timing-rising-moon` | 상승하는 12개월 흐름 |
| `timing-pause-moon` | 속도를 늦출 시기 |
| `closure-thread-cut` | 관계 정리·마침표 |
| `boundary-circle` | 경계선과 자기 기준 |
| `action-plan-calendar` | 30일 행동 계획 |
| `message-do-dont` | 연락 선택 비교 |
| `attraction-spark` | 강렬한 첫 끌림 |
| `longevity-lantern` | 오래가는 관계 |
| `self-worth-crown` | 자기 가치·자존감 |
| `friend-introduction-door` | 친구·지인 소개 |
| `work-connection-table` | 일·프로젝트 인연 |
| `hobby-meeting-studio` | 취미·클래스 만남 |
| `moonlit-date` | 차분한 데이트 흐름 |
| `reunion-shadow` | 이별·재회 분기 |
| `report-seal-final` | 리포트 완성 봉인 |

## 저장 경로와 최적화

- 소스 PNG: `artwork-source/mz-love-fact/*.png`
- WebP: `public/images/mz-love-fact/generated/*.webp`
- AVIF: `public/images/mz-love-fact/generated/*.avif`
- 최적화 스크립트: `scripts/optimize-mz-love-assets.py`
- 매니페스트: `src/lib/mz-love-fact/sceneManifest.ts`
- 동적 선택기: `src/lib/mz-love-fact/sceneResolver.ts`
- 출력 캔버스: 1080×1920
- WebP 품질: 86, 인코더 method 6
- AVIF 품질: 70
- 전경은 비율을 유지한 `contain` 방식으로 보존하고, 배경은 같은 이미지의 어두운 blur cover로 채운다.
- 런타임 `<picture>`는 AVIF를 우선하고 WebP를 폴백으로 사용한다.
- 첫 화면의 핵심 이미지만 eager로 불러오고 나머지는 lazy 로딩한다.

재생성 명령의 기준 형태:

```powershell
python scripts/optimize-mz-love-assets.py --source artwork-source/mz-love-fact --output public/images/mz-love-fact/generated
```

## 런타임 장면 선택

- 각 챕터에는 먼저 챕터별 후보군을 적용한다.
- 파생 판정, 시기 신호, 위험 신호에서 반복·불안·안정·타이밍·정리·경계·30일 계획·연락·첫 끌림·장기성·자기 가치·소개·업무·취미·데이트·재회 등의 의미 신호를 찾아 후보 순서를 조정한다.
- 현재 관계 상태의 선호 장면을 다음 우선순위로 합친다.
- 이미 사용한 키는 제외하여 13개 챕터에 서로 다른 장면 13개를 배치한다.
- 같은 입력은 같은 장면을 선택하며, 장면 선택은 명리 판정 내용에 영향을 주지 않는다.

## 불량 판정과 재검수

- 얼굴 정체성이 기준 이미지와 다름
- 손가락 수, 손목, 부채 손잡이가 비정상
- 눈·치아·귀·장신구가 겹치거나 녹아 있음
- 장면을 방해하는 생성 글자, 로고 또는 워터마크
- 캐릭터가 미성년으로 보이거나 노출이 과함
- 공포·유혈 표현이 상품 톤을 벗어남
- 모바일 크롭에서 눈·입·핵심 소품이 사라짐
- WebP와 AVIF의 장면 내용 또는 파일명이 서로 다름

하나라도 심하면 해당 장면만 같은 공통 프롬프트로 재생성한다. 소스 PNG를 교체하고 최적화본 두 형식을 다시 만든 뒤 375×812, 390×844, 430×932 모바일 화면에서 재확인한다.
