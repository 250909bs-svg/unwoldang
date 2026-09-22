/**
 * 선물 메시지 길이 상한.
 *
 * 서버(`giftService.ts`)가 같은 값으로 자른다. 화면이 더 길게 받으면 손님이 쓴 뒷부분이
 * 조용히 사라지므로, 두 곳이 같은 값을 보게 여기 한 번만 적는다.
 *
 * 서버 모듈을 직접 불러오지 않는 이유: `cloudrun-api` 를 프런트 번들에 끌어오면
 * node 전용 모듈(`node:crypto`)이 함께 따라온다.
 */
export const GIFT_MESSAGE_MAX_LENGTH = 200;
