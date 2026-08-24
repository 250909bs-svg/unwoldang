import type { IntakeFormData, ServiceId } from '../api/mockData';

/**
 * The general-signature report starts with its editorial cover and never with
 * a character film. Concern-reading keeps its existing report character film.
 */
export function getReportCharacterVideo(
  serviceId: ServiceId,
  gender?: IntakeFormData['gender']
): string | null {
  if (serviceId !== 'concern-reading') return null;
  return gender === 'female'
    ? '/report-character-female.mp4'
    : '/report-character-male.mp4';
}
