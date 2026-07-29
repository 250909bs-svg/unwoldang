import type {
  AdminComparison,
  AdminGranularity,
  AdminPeriod,
  AdminView,
  CustomerFilter
} from '../types/admin';
import { getDateKey, getDefaultGranularity } from '../utils/dateRanges';

export type { AdminComparison, AdminGranularity, AdminPeriod, AdminView, CustomerFilter } from '../types/admin';
export type AdminPresetPeriod = Exclude<AdminPeriod, 'custom'>;

export type AdminUiState = {
  activeView: AdminView;
  period: AdminPeriod;
  customStart: string;
  customEnd: string;
  granularity: AdminGranularity;
  comparison: AdminComparison;
  customerFilter: CustomerFilter;
  selectedCustomerId: string;
  selectedOrderId: string;
  adminSearch: string;
  isSearchOpen: boolean;
};

export type AdminUiAction =
  | { type: 'select-view'; view: AdminView }
  | { type: 'select-preset-period'; period: AdminPresetPeriod; granularity?: AdminGranularity }
  | { type: 'change-custom-start'; value: string }
  | { type: 'change-custom-end'; value: string }
  | { type: 'select-granularity'; granularity: AdminGranularity }
  | { type: 'select-comparison'; comparison: AdminComparison }
  | { type: 'select-customer-filter'; filter: CustomerFilter; firstMatchingCustomerId?: string }
  | { type: 'select-order'; orderId: string }
  | { type: 'select-customer'; customerId: string }
  | { type: 'change-search'; value: string }
  | { type: 'open-search' }
  | { type: 'close-search' }
  | { type: 'clear-search' }
  | { type: 'select-order-search-result'; orderId: string }
  | { type: 'select-customer-search-result'; customerId: string };

export const getDefaultAdminGranularity = getDefaultGranularity;

export function createInitialAdminUiState(
  referenceDate = new Date(),
  overrides: Partial<AdminUiState> = {}
): AdminUiState {
  const customStartDate = new Date(referenceDate);
  customStartDate.setDate(customStartDate.getDate() - 29);

  return {
    activeView: 'overview',
    period: '7d',
    customStart: getDateKey(customStartDate),
    customEnd: getDateKey(referenceDate),
    granularity: 'day',
    comparison: 'previous',
    customerFilter: 'all',
    selectedCustomerId: '',
    selectedOrderId: '',
    adminSearch: '',
    isSearchOpen: false,
    ...overrides
  };
}

export function adminUiStateReducer(state: AdminUiState, action: AdminUiAction): AdminUiState {
  switch (action.type) {
    case 'select-view':
      return { ...state, activeView: action.view };
    case 'select-preset-period':
      return {
        ...state,
        period: action.period,
        granularity: action.granularity ?? getDefaultAdminGranularity(action.period)
      };
    case 'change-custom-start':
      return { ...state, customStart: action.value, period: 'custom', granularity: 'day' };
    case 'change-custom-end':
      return { ...state, customEnd: action.value, period: 'custom', granularity: 'day' };
    case 'select-granularity':
      return { ...state, granularity: action.granularity };
    case 'select-comparison':
      return { ...state, comparison: action.comparison };
    case 'select-customer-filter':
      return {
        ...state,
        customerFilter: action.filter,
        selectedCustomerId: action.firstMatchingCustomerId ?? state.selectedCustomerId
      };
    case 'select-order':
      return { ...state, selectedOrderId: action.orderId };
    case 'select-customer':
      return { ...state, selectedCustomerId: action.customerId };
    case 'change-search':
      return { ...state, adminSearch: action.value, isSearchOpen: true };
    case 'open-search':
      return { ...state, isSearchOpen: true };
    case 'close-search':
      return { ...state, isSearchOpen: false };
    case 'clear-search':
      return { ...state, adminSearch: '', isSearchOpen: false };
    case 'select-order-search-result':
      return {
        ...state,
        activeView: 'orders',
        selectedOrderId: action.orderId,
        adminSearch: '',
        isSearchOpen: false
      };
    case 'select-customer-search-result':
      return {
        ...state,
        activeView: 'customers',
        selectedCustomerId: action.customerId,
        adminSearch: '',
        isSearchOpen: false
      };
  }
}
