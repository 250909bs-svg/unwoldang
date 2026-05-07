const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm';

function createBasicAuth(secretKey) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  const secretKey = process.env.TOSS_SECRET_KEY;

  if (!secretKey) {
    return res.status(500).json({ message: 'TOSS_SECRET_KEY가 설정되지 않았습니다.' });
  }

  const { paymentKey, orderId, amount } = req.body ?? {};

  if (!paymentKey || !orderId || typeof amount !== 'number') {
    return res.status(400).json({ message: 'paymentKey, orderId, amount는 필수입니다.' });
  }

  try {
    const response = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: createBasicAuth(secretKey),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount
      })
    });

    const parsed = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: parsed?.message || '토스 결제 승인 요청이 실패했습니다.',
        code: parsed?.code
      });
    }

    return res.status(200).json({
      paymentKey: parsed.paymentKey,
      orderId: parsed.orderId,
      status: parsed.status,
      approvedAt: parsed.approvedAt,
      method: parsed.method,
      totalAmount: parsed.totalAmount,
      receiptUrl: parsed.receipt?.url ?? null,
      raw: parsed
    });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : '토스 결제 승인 처리 중 서버 오류가 발생했습니다.'
    });
  }
}
