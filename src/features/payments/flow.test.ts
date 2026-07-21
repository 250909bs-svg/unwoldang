import { describe, expect, it } from 'vitest';
import { parsePortOneCallback } from './flow';

describe('PortOne callback states', () => {
  it('separates submitted, cancelled, and failed results', () => {
    expect(
      parsePortOneCallback('?paymentId=UW-20990101-callback-payment-0001&txId=tx-1')
    ).toEqual({
      kind: 'submitted',
      paymentId: 'UW-20990101-callback-payment-0001',
      txId: 'tx-1'
    });
    expect(parsePortOneCallback('?payment=portone-fail&message=사용자%20취소')).toMatchObject({
      kind: 'cancelled'
    });
    expect(parsePortOneCallback('?payment=portone-fail&code=PG_ERROR')).toMatchObject({
      kind: 'failed'
    });
  });

  it('does not describe a missing payment id as a success', () => {
    expect(parsePortOneCallback('')).toMatchObject({
      kind: 'failed'
    });
  });
});
