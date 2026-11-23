import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { jwtDecode } from '../utils.js';

const AppContext = createContext(null);

const initialState = {
  auth: null,
  teams: [],
  selectedTeams: new Set(),
  repoData: {},
  releaseGroups: [],
  runGroupMap: {},
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH': {
      const decoded = jwtDecode(action.payload);
      if (!decoded) return state;
      sessionStorage.setItem('pd_jwt', action.payload);
      if (decoded.username) sessionStorage.setItem('pd_username', decoded.username);
      return { ...state, auth: { token: action.payload, ...decoded } };
    }
    case 'CLEAR_AUTH':
      sessionStorage.removeItem('pd_jwt');
      sessionStorage.removeItem('pd_username');
      return { ...state, auth: null };
    case 'SET_TEAMS':
      return { ...state, teams: action.payload };
    case 'SET_SELECTED_TEAMS':
      return { ...state, selectedTeams: action.payload };
    case 'SET_REPO_LOADING': {
      const prev = state.repoData[action.repo] || {};
      return { ...state, repoData: { ...state.repoData, [action.repo]: { ...prev, loading: action.loading } } };
    }
    case 'SET_REPO_DATA': {
      const prev = state.repoData[action.repo] || {};
      return { ...state, repoData: { ...state.repoData, [action.repo]: { ...prev, ...action.payload, loading: false } } };
    }
    case 'SET_RELEASE_GROUPS':
      return { ...state, releaseGroups: action.payload };
    case 'UPDATE_RELEASE_GROUP_COUNT': {
      const groups = state.releaseGroups.map(g =>
        g.id === action.id ? { ...g, pipelineCount: (g.pipelineCount || 0) + action.delta } : g
      );
      return { ...state, releaseGroups: groups };
    }
    case 'SET_RUN_GROUP_MAP':
      return { ...state, runGroupMap: action.payload };
    case 'UPDATE_RUN_GROUP':
      return { ...state, runGroupMap: { ...state.runGroupMap, [String(action.runId)]: action.payload } };
    case 'REMOVE_RUN_GROUP': {
      const map = { ...state.runGroupMap };
      delete map[String(action.runId)];
      return { ...state, runGroupMap: map };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    // Restore saved team selection
    const saved = localStorage.getItem('pd_selectedTeams');
    let selectedTeams = new Set();
    if (saved) {
      try { selectedTeams = new Set(JSON.parse(saved)); } catch {}
    }
    return { ...init, selectedTeams };
  });

  // Restore auth from sessionStorage on mount
  useEffect(() => {
    const token = sessionStorage.getItem('pd_jwt');
    if (token) {
      const decoded = jwtDecode(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        dispatch({ type: 'SET_AUTH', payload: token });
      } else {
        sessionStorage.removeItem('pd_jwt');
      }
    }
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
