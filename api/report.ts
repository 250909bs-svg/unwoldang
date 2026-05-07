import { generateGeminiSajuReport, ReportRequestError } from '../src/lib/server/geminiReportService';

export const config = {
  maxDuration: 60
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'POST 요청만 허용됩니다.' });
  }

  try {
    const payload = await generateGeminiSajuReport(req.body ?? {});
    return res.status(200).json(payload);
  } catch (error) {
    const status = error instanceof ReportRequestError ? error.status : 500;

    return res.status(status).json({
      message: error instanceof Error ? error.message : 'Gemini 사주 리포트 생성 중 오류가 발생했습니다.'
    });
  }
}
