import { describe, expect, it } from 'vitest';
import type { SajuReportData } from '../../lib/saju/report';
import {
  CONTRACT_REPORT_PRODUCT_IDS,
  ReportAdapterRegistry,
  reportAdapterRegistry,
  reportProductAdapters
} from './adapters';

describe('report adapter plugin registry', () => {
  it('registers every contracted report product exactly once', () => {
    expect(reportAdapterRegistry.registeredProductIds()).toEqual(CONTRACT_REPORT_PRODUCT_IDS);
    expect(new Set(reportProductAdapters.map((adapter) => adapter.prompt.version)).size).toBe(5);
  });

  it('rejects duplicate registrations before serving requests', () => {
    expect(() => new ReportAdapterRegistry(
      [reportProductAdapters[0], reportProductAdapters[0]],
      []
    )).toThrow(/Duplicate report adapter registration/);
  });

  it('rejects a registry missing any contracted product', () => {
    expect(() => new ReportAdapterRegistry(reportProductAdapters.slice(0, -1))).toThrow(
      /Missing report adapter registrations: match-couple/
    );
  });

  it('uses an identity legacy adapter for non-contract historical products', () => {
    const adapter = reportAdapterRegistry.resolve('life-flow');
    const sections = [{ id: 'legacy-section', title: 'Legacy section' }];
    const legacyReport = {
      serviceId: 'life-flow',
      sections
    } as unknown as SajuReportData;

    expect(adapter.kind).toBe('legacy');
    expect(adapter.prompt.version).toBe('legacy-report-adapter-v1');
    expect(adapter.sections.select(legacyReport)).toBe(sections);
  });
});
