import { ReportRequestError } from '../../../src/lib/server/geminiReportService.ts';

export { ReportRequestError };

export class PaymentRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'PaymentRequestError';
    this.status = status;
  }
}

export class ReportGenerationInProgressError extends ReportRequestError {
  readonly code = 'REPORT_GENERATION_IN_PROGRESS';
  readonly retryAfterSeconds = 3;

  constructor() {
    super(409, 'Report generation is already in progress for this payment.');
    this.name = 'ReportGenerationInProgressError';
  }
}

export class KakaoAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'KakaoAuthError';
    this.status = status;
  }
}
