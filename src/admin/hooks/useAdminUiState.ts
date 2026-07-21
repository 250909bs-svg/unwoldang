import { useReducer } from 'react';
import {
  adminUiStateReducer,
  createInitialAdminUiState,
  type AdminUiState
} from '../state/adminUiState';

export type UseAdminUiStateOptions = {
  initialState?: Partial<AdminUiState>;
  referenceDate?: Date;
};

function initializeAdminUiState(options: UseAdminUiStateOptions) {
  return createInitialAdminUiState(options.referenceDate, options.initialState);
}

export function useAdminUiState(options: UseAdminUiStateOptions = {}) {
  return useReducer(adminUiStateReducer, options, initializeAdminUiState);
}
