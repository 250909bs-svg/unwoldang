import { describe, expect, it } from 'vitest';
import { buildAnalysisRequestPayload } from './analysisPayload';

describe('analysis request payload', () => {
  it('normalizes primary and partner birth policies before sending to the server', () => {
    const payload = buildAnalysisRequestPayload('match-couple', {
      name: '  본인  ',
      gender: 'female',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1992-09-09',
      birthTime: '10:24',
      isUnknownTime: false,
      birthLocation: {
        label: '서울',
        timezone: 'Asia/Seoul',
        utcOffsetMinutes: 540
      },
      relationshipStatus: '',
      relationshipDuration: '',
      q1: '  관계에서 무엇을 맞춰야 하나요?  ',
      q2: '',
      partner: {
        name: '  상대  ',
        gender: 'male',
        calendar: 'solar',
        isLeapMonth: false,
        birthDate: '1989-04-12',
        birthTime: '08:15',
        isUnknownTime: true
      }
    });

    expect(payload.timezone).toBe('Asia/Seoul');
    expect(payload.birth.precision).toBe('exact');
    expect(payload.birth.dayBoundaryPolicy).toBe('midnight');
    expect(payload.partner).toMatchObject({
      name: '상대',
      birthTime: '',
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'midnight'
    });
    expect(payload.questions).toEqual(['관계에서 무엇을 맞춰야 하나요?']);
  });
});
