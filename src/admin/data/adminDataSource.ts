import { buildSampleOrders } from '../fixtures/sampleOrders';
import type { AdminOrder } from '../types/admin';

export type AdminDataMode = 'real' | 'sample' | 'empty';

export type AdminDataSource = {
  mode: AdminDataMode;
  orders: AdminOrder[];
};

export type ResolveAdminDataOptions = {
  isDev: boolean;
  fixtureEnabled: boolean;
};

export function resolveAdminData(
  realOrders: AdminOrder[],
  { isDev, fixtureEnabled }: ResolveAdminDataOptions
): AdminDataSource {
  if (realOrders.length > 0) {
    return {
      mode: 'real',
      orders: realOrders
    };
  }

  if (isDev && fixtureEnabled) {
    return {
      mode: 'sample',
      orders: buildSampleOrders()
    };
  }

  return {
    mode: 'empty',
    orders: []
  };
}
