/**
 * 재회운 리포트 · CH02 신호 판독표 (명세 §6-B).
 *
 * **항목은 이미 일어난 대화의 속성만이다.** 새로 관찰할 대상을 만들어 주지 않고,
 * 이미 관찰한 것에서 추측을 분리해 의미부여를 깎는 것이 이 표의 전부다.
 *
 * 전 연령·전 밴드 **삭제 확정** 항목(여기에 되살리지 말 것):
 *   - 스토리 조회 / 공개→비공개 전환 / 차단 상태 확인 등 상대를 반복 확인하게 만드는 항목 일체
 *   - 공통 지인을 통한 반응 확인
 *   - 체크박스로 저장·갱신되는 상대 관찰 트래커, 'N개 이상이면 움직여도 된다' 류 임계값
 *   - '들키지 않는 접근' 류 은밀한 접근 최적화 안내
 *
 * `reportPresentation.ts:39-40` 의 금지행동 두 줄이 이 목록의 **상위 규칙**이다.
 * 이 표와 그 목록이 한 화면에서 모순되면 안 된다.
 */

export interface ReunionObservableSignal {
  id: string;
  /** 판독표에 그대로 실리는 라벨. 전부 이미 일어난 대화의 속성이다. */
  label: string;
  /** CH04 유리 구간의 '단, 이때도 ○○가 관찰될 때만' 조건으로 쓸 때의 짧은 표현. */
  condition: string;
  /**
   * 이 항목을 '추측' 칸으로 옮길 때 붙는 한 줄.
   * 관찰 자체는 사실이고, 그 관찰에서 마음을 읽어내는 것이 추측이다.
   */
  guessNote: string;
}

export const REUNION_OBSERVABLE_SIGNALS: readonly ReunionObservableSignal[] = Object.freeze([
  {
    id: 'reply-arrived',
    label: '답장이 왔다',
    condition: '보낸 말에 답이 돌아왔을 때',
    guessNote: '답이 왔다는 건 사실이고, 그 답의 온도는 아직 추측이에요.'
  },
  {
    id: 'reply-length',
    label: '답장이 한 줄보다 길었다',
    condition: '답장이 한 줄보다 길게 이어질 때',
    guessNote: '길이는 사실이고, 길이가 마음의 크기라는 건 추측이에요.'
  },
  {
    id: 'question-returned',
    label: '상대가 질문을 되돌려 줬다',
    condition: '상대가 질문을 되돌려 줄 때',
    guessNote: '되물었다는 건 사실이고, 그게 관심이라는 건 추측이에요.'
  },
  {
    id: 'next-plan-mentioned',
    label: '다음 약속을 상대가 먼저 말했다',
    condition: '다음 약속을 상대가 먼저 꺼낼 때',
    guessNote: '먼저 말했다는 건 사실이고, 그게 재회 의사라는 건 추측이에요.'
  },
  {
    id: 'meeting-proposed',
    label: '만나자는 말이 나왔다',
    condition: '만나자는 말이 대화 안에서 나올 때',
    guessNote: '말이 나온 건 사실이고, 그 말의 무게는 아직 추측이에요.'
  },
  {
    id: 'refusal-stated',
    label: '거절이나 중단 요청이 있었다',
    condition: '거절이나 중단 요청이 없을 때',
    guessNote:
      '거절은 추측으로 덮을 수 없는 사실이에요. 이 항목이 켜지면 다른 항목보다 먼저 봐요.'
  }
]);

export function getReunionSignal(id: string): ReunionObservableSignal | null {
  return REUNION_OBSERVABLE_SIGNALS.find((item) => item.id === id) || null;
}

/**
 * CH04 유리 구간에 붙는 조건. 조건 없는 시기는 렌더하지 않는 것이
 * 적중 실패 시 신뢰 붕괴를 막는 유일한 구조다.
 *
 * **모든 구간에 같은 조건을 붙인다.** 구간마다 다른 조건을 보여주려면 그 차이가
 * 계산에서 나와야 하는데, 월운은 점수 하나뿐이고 어떤 대화 속성이 그 달에 더
 * 중요한지를 가를 근거가 없다. 배열 인덱스를 돌려 조합을 바꾸면 계산되지 않은
 * 구간별 차이를 만들어 낸 것이 되므로, 구간과 무관한 공통 조건으로 고정한다.
 */
export const REUNION_OPEN_WINDOW_CONDITIONS: readonly string[] = Object.freeze(
  REUNION_OBSERVABLE_SIGNALS.filter((item) => item.id !== 'refusal-stated')
    .slice(0, 2)
    .map((item) => item.condition)
);

/** CH04 판단 기한까지 확인할 신호 3개. 각 25자 이내. */
export const REUNION_DEADLINE_WATCH_SIGNALS: readonly string[] = Object.freeze([
  REUNION_OBSERVABLE_SIGNALS[0].label,
  REUNION_OBSERVABLE_SIGNALS[2].label,
  REUNION_OBSERVABLE_SIGNALS[3].label
]);
