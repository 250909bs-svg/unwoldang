export const config = {
  maxDuration: 5
};

export default function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  return res.status(410).json({
    message: 'Report generation is served by the Cloud Run API after verified payment.'
  });
}
