import { describe, expect, it, vi } from 'vitest';
import {
  GiftService,
  normalizeGiftCode,
  sanitizeGiftMessage
} from '../../../cloudrun-api/src/domains/gifts/giftService.ts';
import {
  createGiftCode,
  type GiftRecord
} from '../../../cloudrun-api/src/repositories/giftRepository.ts';

const NOW = Date.parse('2026-09-22T00:00:00.000Z');

function gift(overrides: Partial<GiftRecord> = {}): GiftRecord {
  return {
    documentId: 'doc',
    path: '/giftCodes/doc',
    code: 'ABCDEFGHJKLMNPQR',
    orderId: 'UW-1790000000000-abcdefghijkl',
    paymentId: 'UW-1790000000000-abcdefghijkl',
    productId: 'general-signature',
    amount: 990,
    entitlementId: 'entitlement-1',
    buyerUserId: 'buyer-1',
    buyerName: '산 사람',
    message: '생일 축하해',
    createdAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2026-12-01T00:00:00.000Z',
    redeemedByUserId: '',
    redeemedAt: '',
    updateTime: '2026-09-01T00:00:00.000Z',
    ...overrides
  };
}

function createService(stored: GiftRecord | null) {
  const redeem = vi.fn(async (record: GiftRecord, userId: string) => ({
    ...record,
    redeemedByUserId: userId
  }));
  const createReportAccessToken = vi.fn(() => 'report-token');

  return {
    redeem,
    createReportAccessToken,
    service: new GiftService({
      repository: {
        find: async () => stored,
        get: async () => stored as GiftRecord,
        create: async () => ({ created: true as const, gift: gift() }),
        redeem
      } as never,
      tokenService: {
        createUserBinding: (userId: string) => `binding-${userId}`,
        createReportAccessToken
      },
      reportAccessTokenTtlMs: 30 * 60 * 1000,
      now: () => NOW
    })
  };
}

describe('선물하기', () => {
  it('코드는 읽기 쉬운 글자만 쓴다 — 0/O, 1/I 를 섞지 않는다', () => {
    /* 링크가 막히면 전화로 불러 줘야 하는 값이다. */
    const code = createGiftCode(() => Buffer.from(Array.from({ length: 16 }, (_, i) => i * 7)));

    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    expect(code).toHaveLength(16);
    expect(code).not.toMatch(/[01OI]/);
  });

  it('코드를 정규화해서 찾는다', () => {
    expect(normalizeGiftCode(' abcd-efgh ')).toBe('ABCDEFGH');
    expect(normalizeGiftCode(null)).toBe('');
  });

  it('메시지를 다듬고 길이를 자른다', () => {
    expect(sanitizeGiftMessage('  여러  줄\n\n메시지 ')).toBe('여러 줄 메시지');
    expect(sanitizeGiftMessage('가'.repeat(500))).toHaveLength(200);
  });

  it('링크를 연 사람에게 결제 원장을 가리키는 값을 주지 않는다', async () => {
    /*
     * 이 테스트가 이 파일의 이유다. 선물 조회는 로그인 없이 되는데, 거기서 주문번호나
     * 권한 ID 가 새면 그 값으로 결제 원장을 더듬을 수 있다.
     */
    const { service } = createService(gift());
    const described = await service.describe('ABCDEFGHJKLMNPQR');

    expect(Object.keys(described).sort()).toEqual(
      ['buyerName', 'code', 'expiresAt', 'message', 'productId', 'state'].sort()
    );
    expect(JSON.stringify(described)).not.toContain('UW-1790000000000');
    expect(JSON.stringify(described)).not.toContain('entitlement-1');
    expect(JSON.stringify(described)).not.toContain('buyer-1');
  });

  it('받으면 산 사람의 결속으로 리포트 토큰을 낸다', async () => {
    /*
     * 결제 원장이 산 사람의 userBinding 으로 잠겨 있다
     * (`reportService.assertLedgerMatchesClaims`). 받는 사람의 결속으로 발급하면
     * 원장과 맞지 않아 리포트가 거절된다.
     */
    const { service, createReportAccessToken, redeem } = createService(gift());

    const result = await service.redeem('recipient-1', 'ABCDEFGHJKLMNPQR');

    expect(redeem).toHaveBeenCalledOnce();
    expect(createReportAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'buyer-1', entitlementId: 'entitlement-1', amount: 990 })
    );
    expect(result.reportAccessToken).toBe('report-token');
  });

  it('남이 이미 쓴 선물은 거절한다', async () => {
    const { service } = createService(gift({ redeemedByUserId: 'someone-else' }));

    await expect(service.redeem('recipient-1', 'ABCDEFGHJKLMNPQR')).rejects.toThrow(
      '이미 사용된 선물입니다.'
    );
  });

  it('받은 사람이 자기 것을 다시 열면 토큰을 다시 낸다', async () => {
    /* 토큰은 30분이라 실제로 만료된다. 그때 자기 선물을 못 열면 돈만 내고 못 받는다. */
    const { service, redeem } = createService(gift({ redeemedByUserId: 'recipient-1' }));

    const result = await service.redeem('recipient-1', 'ABCDEFGHJKLMNPQR');

    expect(result.reportAccessToken).toBe('report-token');
    // 이미 소모된 선물이므로 저장소를 다시 갱신하지 않는다.
    expect(redeem).not.toHaveBeenCalled();
  });

  it('기간이 지난 선물은 받지 못한다', async () => {
    const { service } = createService(gift({ expiresAt: '2026-09-01T00:00:00.000Z' }));

    await expect(service.redeem('recipient-1', 'ABCDEFGHJKLMNPQR')).rejects.toThrow(
      '사용 기간이 지난 선물입니다.'
    );
  });

  it('없는 코드는 404 로 답한다', async () => {
    const { service } = createService(null);

    await expect(service.describe('NOPE')).rejects.toThrow('사용할 수 없는 선물입니다');
    await expect(service.redeem('recipient-1', 'NOPE')).rejects.toThrow('사용할 수 없는 선물입니다');
  });

  it('저장소가 없으면 선물을 만들지 않는다', async () => {
    const service = new GiftService({
      repository: null,
      tokenService: {
        createUserBinding: () => 'binding',
        createReportAccessToken: () => 'token'
      },
      reportAccessTokenTtlMs: 1000,
      now: () => NOW
    });

    expect(service.enabled).toBe(false);
    await expect(service.describe('ABCD')).rejects.toThrow('선물 보관소가 준비되지 않아');
  });

  it('상태를 서버가 정해 준다', async () => {
    expect((await createService(gift()).service.describe('A')).state).toBe('open');
    expect(
      (await createService(gift({ redeemedByUserId: 'x' })).service.describe('A')).state
    ).toBe('used');
    expect(
      (await createService(gift({ expiresAt: '2026-01-01T00:00:00.000Z' })).service.describe('A')).state
    ).toBe('expired');
  });
});
