import { useReducer, useCallback } from 'react';
import type { AppState, AppAction, MsiFile, PatternAdjustments } from '../types/msi';
import { PLOT_COLORS } from '../constants/plotColors';

const initialState: AppState = {
  files: [],
  selectedFileId: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_FILE':
      return {
        ...state,
        files: [...state.files, action.payload],
        selectedFileId: action.payload.id,
      };
    case 'REMOVE_FILE': {
      const remaining = state.files.filter(f => f.id !== action.payload);
      return {
        ...state,
        files: remaining,
        selectedFileId:
          state.selectedFileId === action.payload
            ? (remaining[0]?.id ?? null)
            : state.selectedFileId,
      };
    }
    case 'TOGGLE_VISIBILITY':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload ? { ...f, visible: !f.visible } : f
        ),
      };
    case 'SET_VISIBILITY_BATCH': {
      const idSet = new Set(action.payload.ids);
      return {
        ...state,
        files: state.files.map(f =>
          idSet.has(f.id) ? { ...f, visible: action.payload.visible } : f
        ),
      };
    }
    case 'SELECT_FILE':
      return { ...state, selectedFileId: action.payload };
    case 'CLEAR_ALL':
      return initialState;
    case 'SET_COLOR':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload.id ? { ...f, color: action.payload.color } : f
        ),
      };
    case 'SET_ADJUSTMENTS':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload.id ? { ...f, adjustments: action.payload.adjustments } : f
        ),
      };
    case 'RESET_ADJUSTMENTS':
      return {
        ...state,
        files: state.files.map(f =>
          f.id === action.payload ? { ...f, adjustments: undefined } : f
        ),
      };
    case 'LOAD_SESSION':
      return {
        files: action.payload.files,
        selectedFileId: action.payload.selectedFileId,
      };
    default:
      return state;
  }
}

export function useAntennaStore() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addFile = useCallback((file: MsiFile) => {
    dispatch({ type: 'ADD_FILE', payload: file });
  }, []);

  const removeFile = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_FILE', payload: id });
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_VISIBILITY', payload: id });
  }, []);

  const selectFile = useCallback((id: string) => {
    dispatch({ type: 'SELECT_FILE', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const setVisibilityBatch = useCallback((ids: string[], visible: boolean) => {
    dispatch({ type: 'SET_VISIBILITY_BATCH', payload: { ids, visible } });
  }, []);

  const setColor = useCallback((id: string, color: string) => {
    dispatch({ type: 'SET_COLOR', payload: { id, color } });
  }, []);

  const setAdjustments = useCallback((id: string, adjustments: PatternAdjustments) => {
    dispatch({ type: 'SET_ADJUSTMENTS', payload: { id, adjustments } });
  }, []);

  const resetAdjustments = useCallback((id: string) => {
    dispatch({ type: 'RESET_ADJUSTMENTS', payload: id });
  }, []);

  const loadSession = useCallback((files: MsiFile[], selectedFileId: string | null) => {
    dispatch({ type: 'LOAD_SESSION', payload: { files, selectedFileId } });
  }, []);

  const selectedFile = state.files.find(f => f.id === state.selectedFileId) ?? null;
  const nextColor = PLOT_COLORS[state.files.length % PLOT_COLORS.length];

  return {
    state,
    selectedFile,
    nextColor,
    addFile,
    removeFile,
    toggleVisibility,
    selectFile,
    clearAll,
    setVisibilityBatch,
    setColor,
    setAdjustments,
    resetAdjustments,
    loadSession,
  };
}
