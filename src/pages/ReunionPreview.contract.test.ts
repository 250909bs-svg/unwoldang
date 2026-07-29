import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('reunion preview safety contract', () => {
  const source = readFileSync(new URL('./ReunionPreview.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles/reunion.css', import.meta.url), 'utf8');
  const reportSource = readFileSync(new URL('./Report.tsx', import.meta.url), 'utf8');
  const experienceSource = readFileSync(
    new URL('../components/ReunionReportExperience.tsx', import.meta.url),
    'utf8'
  );

  it('never opens checkout when analysis is blocked', () => {
    expect(source).toContain("if (result?.report?.safety.status === 'ANALYSIS_BLOCKED') return;");
    expect(source).toContain("disabled={report.safety.status === 'ANALYSIS_BLOCKED'}");
  });

  it('visually distinguishes the disabled unlock action', () => {
    expect(styles).toContain('.reunion-locked-preview button:disabled');
  });


  it('reopens the canonical server report without retaining raw reunion intake', () => {
    expect(reportSource).toContain('reportData?.reunionStrategy');
    expect(reportSource).toContain(
      "formData: report.serviceId === 'love-reunion' ? undefined : formData"
    );
    expect(experienceSource).toContain('prebuiltReport ?? buildReunionReport(input)');
  });
});
