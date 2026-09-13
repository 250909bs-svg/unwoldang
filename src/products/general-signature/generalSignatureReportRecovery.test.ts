import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import type { ReportArchiveEntry } from '../../lib/reportArchive';
import {
  isRecoverableGeneralSignatureInput,
  parseGeneralSignatureDraft,
  selectLatestGeneralSignatureArchive
} from './generalSignatureReportRecovery';

const maleFixture: IntakeFormData = {
  name: '차민호', gender: 'male', calendar: 'solar', isLeapMonth: false,
  birthDate: '1992-09-09', birthTime: '10:24', isUnknownTime: false,
  birthTimePrecision: 'exact', dayBoundaryPolicy: 'midnight', location: '서울',
  relationshipStatus: 'dating', relationshipDuration: 'under3',
  q1: '사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?',
  q2: '회사에서 승진을 기다릴지 이직할지 고민입니다.'
};

describe('general-signature report recovery', () => {
  it('restores the actual male draft without changing identity, gender, or time', () => {
    const restored = parseGeneralSignatureDraft(JSON.stringify(maleFixture));
    expect(restored?.name).toBe('차민호');
    expect(restored?.gender).toBe('male');
    expect(restored?.birthTime).toBe('10:24');
    expect(isRecoverableGeneralSignatureInput(restored)).toBe(true);
  });

  it('rejects missing or unselected gender instead of silently choosing female', () => {
    expect(parseGeneralSignatureDraft(null)).toBeNull();
    expect(parseGeneralSignatureDraft(JSON.stringify({ ...maleFixture, gender: '' }))).toBeNull();
  });

  it('preserves an explicitly selected female gender', () => {
    const restored = parseGeneralSignatureDraft(JSON.stringify({ ...maleFixture, gender: 'female' }));
    expect(restored?.gender).toBe('female');
  });

  it.each(['single', 'situationship', 'dating'] as const)(
    'recovers all four duration variants for %s',
    (relationshipStatus) => {
      (['under1', 'under3', 'under5', 'under10'] as const).forEach((relationshipDuration) => {
        const restored = parseGeneralSignatureDraft(JSON.stringify({
          ...maleFixture,
          relationshipStatus,
          relationshipDuration
        }));
        expect(restored).toMatchObject({ relationshipStatus, relationshipDuration });
      });
    }
  );

  it('selects the latest real general-signature archive for refresh recovery', () => {
    const makeEntry = (createdAt: string, name: string): ReportArchiveEntry => ({
      id: `general-signature:${createdAt}`,
      orderId: 'UW-123456789012',
      productId: 'general-signature',
      customerName: name,
      title: '종합사주', subtitle: '인생 설계서', createdAt,
      formData: { ...maleFixture, name },
      reportData: buildSajuReport('general-signature', { ...maleFixture, name })
    });
    const selected = selectLatestGeneralSignatureArchive([
      makeEntry('2026-01-01T00:00:00.000Z', '이전'),
      makeEntry('2026-02-01T00:00:00.000Z', '최신')
    ]);
    expect(selected?.customerName).toBe('최신');
    expect(selected?.formData?.gender).toBe('male');
  });
});
