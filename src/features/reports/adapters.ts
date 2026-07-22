import type { ReportSection, SajuReportData } from '../../lib/saju/report';
import type { ProductId } from '../../products/types';
import type { ReportRequestV1 } from './contracts';

export const CONTRACT_REPORT_PRODUCT_IDS = [
  'general-signature',
  'past-life-goblin',
  'love-reading',
  'love-reunion',
  'match-couple'
] as const;

export type ContractReportProductId = (typeof CONTRACT_REPORT_PRODUCT_IDS)[number];

export type ReportPromptDescriptor = {
  productId: ProductId;
  profile: string;
  adapterVersion: string;
  requestSchemaVersion: ReportRequestV1['schemaVersion'];
};

export type ReportPromptAdapter = {
  version: string;
  describe(request: ReportRequestV1): ReportPromptDescriptor;
};

export type ReportSectionAdapter = {
  version: string;
  select(report: SajuReportData): readonly ReportSection[];
};

export type ReportProductAdapter = {
  productId: ProductId;
  kind: 'registered' | 'legacy';
  prompt: ReportPromptAdapter;
  sections: ReportSectionAdapter;
};

const createRegisteredAdapter = (
  productId: ContractReportProductId,
  profile: string
): ReportProductAdapter => {
  const adapterVersion = `${productId}-adapter-v1`;
  return Object.freeze({
    productId,
    kind: 'registered' as const,
    prompt: Object.freeze({
      version: adapterVersion,
      describe(request: ReportRequestV1) {
        if (request.serviceId !== productId) {
          throw new Error(`Report prompt adapter ${productId} cannot handle ${request.serviceId}.`);
        }
        return {
          productId,
          profile,
          adapterVersion,
          requestSchemaVersion: request.schemaVersion
        };
      }
    }),
    sections: Object.freeze({
      version: adapterVersion,
      select(report: SajuReportData) {
        if (report.serviceId !== productId) {
          throw new Error(`Report section adapter ${productId} cannot handle ${report.serviceId}.`);
        }
        return report.sections;
      }
    })
  });
};

export const reportProductAdapters = Object.freeze([
  createRegisteredAdapter('general-signature', 'general-signature-v1'),
  createRegisteredAdapter('past-life-goblin', 'past-life-symbolic-v1'),
  createRegisteredAdapter('love-reading', 'love-reading-v1'),
  createRegisteredAdapter('love-reunion', 'love-reunion-v1'),
  createRegisteredAdapter('match-couple', 'match-couple-v1')
]);

function createLegacyAdapter(productId: ProductId): ReportProductAdapter {
  const adapterVersion = 'legacy-report-adapter-v1';
  return Object.freeze({
    productId,
    kind: 'legacy' as const,
    prompt: Object.freeze({
      version: adapterVersion,
      describe(request: ReportRequestV1) {
        return {
          productId: request.serviceId,
          profile: 'legacy-report-v1',
          adapterVersion,
          requestSchemaVersion: request.schemaVersion
        };
      }
    }),
    sections: Object.freeze({
      version: adapterVersion,
      select(report: SajuReportData) {
        return report.sections;
      }
    })
  });
}

export class ReportAdapterRegistry {
  private readonly adapters = new Map<ProductId, ReportProductAdapter>();

  constructor(
    adapters: readonly ReportProductAdapter[],
    requiredProductIds: readonly ContractReportProductId[] = CONTRACT_REPORT_PRODUCT_IDS
  ) {
    adapters.forEach((adapter) => {
      if (this.adapters.has(adapter.productId)) {
        throw new Error(`Duplicate report adapter registration: ${adapter.productId}`);
      }
      this.adapters.set(adapter.productId, adapter);
    });

    const missing = requiredProductIds.filter((productId) => !this.adapters.has(productId));
    if (missing.length > 0) {
      throw new Error(`Missing report adapter registrations: ${missing.join(', ')}`);
    }
  }

  resolve(productId: ProductId): ReportProductAdapter {
    return this.adapters.get(productId) ?? createLegacyAdapter(productId);
  }

  registeredProductIds() {
    return Object.freeze([...this.adapters.keys()]);
  }
}

export const reportAdapterRegistry = Object.freeze(new ReportAdapterRegistry(reportProductAdapters));

export function getReportProductAdapter(productId: ProductId) {
  return reportAdapterRegistry.resolve(productId);
}
