import { describe, expect, it } from 'vitest';
import { getReportCharacterVideo } from './reportMedia';

describe('report character media policy', () => {
  it('never renders a post-payment character MP4 for general-signature', () => {
    expect(getReportCharacterVideo('general-signature', 'male')).toBeNull();
    expect(getReportCharacterVideo('general-signature', 'female')).toBeNull();
  });

  it('keeps the existing concern-reading character MP4', () => {
    expect(getReportCharacterVideo('concern-reading', 'male')).toBe('/report-character-male.mp4');
    expect(getReportCharacterVideo('concern-reading', 'female')).toBe('/report-character-female.mp4');
  });

  it('does not attach the general report character to unrelated products', () => {
    expect(getReportCharacterVideo('love-reading', 'female')).toBeNull();
    expect(getReportCharacterVideo('past-life-goblin', 'male')).toBeNull();
  });
});
