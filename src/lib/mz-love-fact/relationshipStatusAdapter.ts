import type { IntakeFormData } from '../../api/mockData';
import type { RelationshipStatus } from './types';

/**
 * Converts the customer-facing intake values into the relationship branches
 * understood by the MZ love report domain model.
 */
export function mapIntakeRelationshipStatus(
  status?: IntakeFormData['relationshipStatus'],
): RelationshipStatus | undefined {
  switch (status) {
    case 'single':
    case 'situationship':
    case 'dating':
    case 'ambiguous':
    case 'breakup-reunion':
      return status;
    case 'married':
      return 'long-term';
    case '':
    case undefined:
    default:
      return undefined;
  }
}
