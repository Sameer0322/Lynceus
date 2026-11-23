import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { stCls, ago } from '../../utils.js';

export default function Header({ onNavigateHome, onNavigateReleases, onRefresh, onAdminOpen, onChangePwOpen, onLogout, onToggleTheme }) {
  const { state, dispatch } = useApp();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [lastRefresh] = useState(new Date());
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Compute header stats from all loaded repo workflows
  let ok = 0, fail = 0, run = 0;
  for (const rd of Object.values(state.repoData)) {
    for (const wf of (rd.workflows || [])) {
      const r = wf.runs?.[0];
      if (!r) continue;
      const c = stCls(r.status, r.conclusion);
      if (c === 'success') ok++;
      else if (c === 'failure') fail++;
      else if (c === 'running') run++;
    }
  }

  const isDark = () =>
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const themeIcon = isDark() ? '☀' : '🌙';

  return (
    <header className="header">
      <span className="header-title header-home-link" onClick={onNavigateHome} title="Go to home">
        Lynceaus
      </span>
      <div className="header-divider" />
      <div className="header-stats">
        {ok > 0 && <span className="stat-chip chip-success">✓ {ok}</span>}
        {fail > 0 && <span className="stat-chip chip-failure">✗ {fail}</span>}
        {run > 0 && <span className="stat-chip chip-running">⟳ {run}</span>}
      </div>
      <div className="header-right">
        <button className="btn-icon" onClick={onNavigateReleases}>Release Groups</button>
        <button className="btn-icon" onClick={onToggleTheme} title="Toggle light/dark mode">{themeIcon}</button>
        <button className="btn-icon" onClick={onRefresh} title="Refresh now">↻ Refresh</button>
        <div className="user-chip" ref={dropdownRef} onClick={e => { e.stopPropagation(); setDropdownOpen(v => !v); }}>
            <span>
              {state.auth?.role === 'admin' && <span className="role-badge">Admin</span>}
              {' '}{state.auth?.username}
            </span>
            <div className={`user-dropdown${dropdownOpen ? ' open' : ''}`}>
              <button className="user-dropdown-item" onClick={() => { setDropdownOpen(false); onChangePwOpen(); }}>
                Change Password
              </button>
              {state.auth?.role === 'admin' && (
                <button className="user-dropdown-item admin-only" onClick={() => { setDropdownOpen(false); onAdminOpen(); }}>
                  Admin Panel
                </button>
              )}
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item danger" onClick={() => { setDropdownOpen(false); onLogout(); }}>
                Log Out
              </button>
            </div>
          </div>
      </div>
    </header>
  );
}
