import { describe, expect, it } from 'vitest';
import type { AppConfig } from '../../config/env.ts';
import { ArchiveService, type ArchiveEntry, type ArchiveRepository } from './archiveService.ts';

const config = { report: { requireTokenForArchive: false } } as AppConfig;
const tokens = {
  verifyReportAccessToken: () => { throw new Error('not used'); },
  createUserBinding: (userId: string) => userId
};
const entry: ArchiveEntry = {
  id: 'love-reunion:order-1',
  orderId: 'order-1',
  productId: 'love-reunion',
  customerName: '본인',
  title: '재회운',
  subtitle: '',
  createdAt: '2026-09-15T00:00:00.000Z',
  formData: {
    name: '본인',
    birthDate: '1992-09-09',
    partner: { name: '상대', birthDate: '1991-05-14', birthTime: '08:30' },
    reunionContext: { contactStatus: 'no-contact' }
  },
  reportData: {}
};

describe('archive privacy projection', () => {
  it('removes partner raw input before Firestore upsert', async () => {
    let storedEntry: ArchiveEntry | undefined;
    let storedSerialized = '';
    const upsert: ArchiveRepository['upsert'] = async (_userId, savedEntry, serialized) => {
      storedEntry = savedEntry;
      storedSerialized = serialized;
    };
    const repository: ArchiveRepository = { upsert, list: async () => [] };
    const service = new ArchiveService(config, repository, tokens);
    await service.save('user-1', { entry });
    expect(storedEntry?.formData?.partner).toBeUndefined();
    expect(JSON.parse(storedSerialized || '{}').formData.partner).toBeUndefined();
  });

  it('removes partner raw input from existing Firestore list responses', async () => {
    const repository: ArchiveRepository = {
      upsert: async () => undefined,
      list: async () => [entry]
    };
    const service = new ArchiveService(config, repository, tokens);
    const result = await service.list('user-1');
    expect(result[0]?.formData?.partner).toBeUndefined();
    expect(result[0]?.formData?.reunionContext).toEqual({ contactStatus: 'no-contact' });
  });
});
