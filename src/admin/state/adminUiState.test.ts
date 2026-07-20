import { describe, expect, it } from 'vitest';
import {
  adminUiStateReducer,
  createInitialAdminUiState,
  getDefaultAdminGranularity,
  type AdminGranularity,
  type AdminPresetPeriod,
  type AdminUiAction,
  type AdminUiState
} from './adminUiState';

const referenceDate = new Date(2026, 6, 21, 16, 30, 0, 0);

function initial(overrides: Partial<AdminUiState> = {}) {
  return createInitialAdminUiState(referenceDate, overrides);
}

function reduce(state: AdminUiState, ...actions: AdminUiAction[]) {
  return actions.reduce(adminUiStateReducer, state);
}

describe('admin UI state', () => {
  it('starts with the existing dashboard defaults and a thirty-day custom window', () => {
    expect(initial()).toEqual({
      activeView: 'overview',
      period: '7d',
      customStart: '2026-06-22',
      customEnd: '2026-07-21',
      granularity: 'day',
      comparison: 'previous',
      customerFilter: 'all',
      selectedCustomerId: '',
      selectedOrderId: '',
      adminSearch: '',
      isSearchOpen: false
    });
  });

  it('changes only the active view when a dashboard tab is selected', () => {
    const state = initial({
      period: 'quarter',
      granularity: 'week',
      comparison: 'yearAgo',
      customerFilter: 'vip',
      selectedCustomerId: 'customer-1',
      selectedOrderId: 'order-1',
      adminSearch: '운월당',
      isSearchOpen: true
    });

    expect(adminUiStateReducer(state, { type: 'select-view', view: 'costs' })).toEqual({
      ...state,
      activeView: 'costs'
    });
  });

  it.each<[AdminPresetPeriod, AdminGranularity]>([
    ['today', 'hour'],
    ['yesterday', 'hour'],
    ['7d', 'day'],
    ['30d', 'day'],
    ['month', 'day'],
    ['quarter', 'week'],
    ['year', 'month'],
    ['all', 'month']
  ])('selects the %s preset with %s granularity', (period, granularity) => {
    const state = initial({ activeView: 'reports', comparison: 'none', customerFilter: 'risk' });
    const next = adminUiStateReducer(state, { type: 'select-preset-period', period });

    expect(getDefaultAdminGranularity(period)).toBe(granularity);
    expect(next).toEqual({ ...state, period, granularity });
  });

  it('accepts an injected granularity for a preset without changing other controls', () => {
    const state = initial({ activeView: 'orders', comparison: 'yearAgo' });

    expect(adminUiStateReducer(state, {
      type: 'select-preset-period',
      period: 'quarter',
      granularity: 'day'
    })).toEqual({ ...state, period: 'quarter', granularity: 'day' });
  });

  it('turns either custom date edit into a custom daily range and preserves the other date', () => {
    const state = initial({
      activeView: 'customers',
      period: 'year',
      granularity: 'month',
      comparison: 'yearAgo',
      customerFilter: 'paid'
    });
    const startChanged = adminUiStateReducer(state, { type: 'change-custom-start', value: '2026-07-01' });
    const endChanged = adminUiStateReducer(state, { type: 'change-custom-end', value: '2026-07-15' });

    expect(startChanged).toEqual({
      ...state,
      customStart: '2026-07-01',
      period: 'custom',
      granularity: 'day'
    });
    expect(endChanged).toEqual({
      ...state,
      customEnd: '2026-07-15',
      period: 'custom',
      granularity: 'day'
    });
  });

  it('updates granularity and comparison independently', () => {
    const state = initial({ activeView: 'funnel', customerFilter: 'vip' });
    const next = reduce(
      state,
      { type: 'select-granularity', granularity: 'week' },
      { type: 'select-comparison', comparison: 'none' }
    );

    expect(next).toEqual({ ...state, granularity: 'week', comparison: 'none' });
  });

  it('selects the first matching customer for a filter and preserves the selection when none matches', () => {
    const state = initial({ selectedCustomerId: 'customer-current' });
    const matched = adminUiStateReducer(state, {
      type: 'select-customer-filter',
      filter: 'risk',
      firstMatchingCustomerId: 'customer-risk'
    });
    const unmatched = adminUiStateReducer(matched, {
      type: 'select-customer-filter',
      filter: 'registered'
    });

    expect(matched.selectedCustomerId).toBe('customer-risk');
    expect(unmatched).toEqual({
      ...matched,
      customerFilter: 'registered'
    });
  });

  it('keeps direct row selections separate from the current tab', () => {
    const state = initial({ activeView: 'overview' });
    const next = reduce(
      state,
      { type: 'select-order', orderId: 'order-2' },
      { type: 'select-customer', customerId: 'customer-2' }
    );

    expect(next).toEqual({
      ...state,
      selectedOrderId: 'order-2',
      selectedCustomerId: 'customer-2'
    });
  });

  it('opens, closes and clears search with the current input behavior', () => {
    const changed = adminUiStateReducer(initial(), { type: 'change-search', value: 'UW-2026' });
    const closed = adminUiStateReducer(changed, { type: 'close-search' });
    const reopened = adminUiStateReducer(closed, { type: 'open-search' });
    const cleared = adminUiStateReducer(reopened, { type: 'clear-search' });

    expect(changed).toMatchObject({ adminSearch: 'UW-2026', isSearchOpen: true });
    expect(closed).toMatchObject({ adminSearch: 'UW-2026', isSearchOpen: false });
    expect(reopened).toMatchObject({ adminSearch: 'UW-2026', isSearchOpen: true });
    expect(cleared).toMatchObject({ adminSearch: '', isSearchOpen: false });
  });

  it('opens an order search result in the orders tab and closes search', () => {
    const state = initial({
      activeView: 'customers',
      adminSearch: 'UW-2026',
      isSearchOpen: true,
      selectedCustomerId: 'customer-current'
    });

    expect(adminUiStateReducer(state, {
      type: 'select-order-search-result',
      orderId: 'order-result'
    })).toEqual({
      ...state,
      activeView: 'orders',
      selectedOrderId: 'order-result',
      adminSearch: '',
      isSearchOpen: false
    });
  });

  it('opens a customer search result in the customers tab and closes search', () => {
    const state = initial({
      activeView: 'orders',
      adminSearch: '홍길동',
      isSearchOpen: true,
      selectedOrderId: 'order-current'
    });

    expect(adminUiStateReducer(state, {
      type: 'select-customer-search-result',
      customerId: 'customer-result'
    })).toEqual({
      ...state,
      activeView: 'customers',
      selectedCustomerId: 'customer-result',
      adminSearch: '',
      isSearchOpen: false
    });
  });
});
