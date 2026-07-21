import { requestPortOnePayment } from '../../lib/portonePayments';
import type { PaymentOrderIntent } from './contracts';
import { isCancellationMessage } from './flow';

export type PortOneOpenResult =
  | { kind: 'submitted'; paymentId: string; txId?: string }
  | { kind: 'cancelled'; message: string }
  | { kind: 'failed'; message: string };

export async function openPortOnePayment(options: {
  intent: PaymentOrderIntent;
  storeId: string;
  channelKey: string;
  orderName: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  redirectUrl: string;
}): Promise<PortOneOpenResult> {
  try {
    const response = await requestPortOnePayment({
      storeId: options.storeId,
      channelKey: options.channelKey,
      paymentId: options.intent.orderId,
      orderName: options.orderName,
      totalAmount: options.intent.amount,
      customerId: options.customerId,
      customerName: options.customerName,
      customerEmail: options.customerEmail,
      customerPhone: options.customerPhone,
      redirectUrl: options.redirectUrl,
      customData: {
        productId: options.intent.productId,
        paymentMethod: 'portone',
        orderClaim: options.intent.orderClaim
      }
    });

    if (!response) {
      return {
        kind: 'cancelled',
        message: '결제창을 닫았습니다. 승인된 금액은 없습니다.'
      };
    }

    return {
      kind: 'submitted',
      paymentId: response.paymentId || options.intent.orderId,
      txId: response.txId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PortOne 결제창을 열지 못했습니다.';

    return isCancellationMessage(message)
      ? { kind: 'cancelled', message }
      : { kind: 'failed', message };
  }
}
