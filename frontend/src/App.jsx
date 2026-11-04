import React, { useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Header from './components/layout/Header.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import PipelinesPage from './pages/PipelinesPage.jsx';
import RunListPage from './pages/RunListPage.jsx';
import StageViewPage from './pages/StageViewPage.jsx';
import ReleaseGroupsPage from './pages/ReleaseGroupsPage.jsx';
import LoginDialog from './components/dialogs/LoginDialog.jsx';
import AdminPanel from './components/dialogs/AdminPanel.jsx';
import ChangePasswordDialog from './components/dialogs/ChangePasswordDialog.jsx';

function AppShell() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Track active repo/wf from URL for sidebar
  const [activeRepo, setActiveRepo] = useState('');
  const [activeWfId, setActiveWfId] = useState(null);

  function handleSelectWorkflow(repo, wfId) {
    setActiveRepo(repo);
    setActiveWfId(wfId);
    navigate(`/repo/${encodeURIComponent(repo)}/wf/${wfId}`);
  }

  function handleNavigateHome() {
    setActiveRepo('');
    setActiveWfId(null);
    navigate('/');
  }

  function handleToggleTheme() {
    const html = document.documentElement;
    const isDark = html.dataset.theme === 'dark' ||
      (!html.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const next = isDark ? 'light' : 'dark';
    html.dataset.theme = next;
    localStorage.setItem('pd_theme', next);
  }

  function handleLogout() {
    dispatch({ type: 'CLEAR_AUTH' });
  }

  function handleRefresh() {
    setRefreshSignal(v => v + 1);
  }

  return (
    <>
      <div id="app">
        <Header
          onNavigateHome={handleNavigateHome}
          onNavigateReleases={() => navigate('/releases')}
          onRefresh={handleRefresh}
          onAdminOpen={() => state.auth?.role === 'admin' && setAdminOpen(true)}
          onChangePwOpen={() => setChangePwOpen(true)}
          onLogout={handleLogout}
          onToggleTheme={handleToggleTheme}
        />
        <div className="app-layout">
          <Sidebar
            activeRepo={activeRepo}
            activeWfId={activeWfId}
            onSelectWorkflow={handleSelectWorkflow}
            onNavigateHome={handleNavigateHome}
          />
          <main className="main-content">
            <Routes>
              <Route path="/" element={
                <PipelinesPage
                  onRefreshSignal={refreshSignal}
                  onSelectWorkflow={handleSelectWorkflow}
                />
              } />
              <Route path="/repo/:repo/wf/:wfId" element={
                <RouteWatcher onActive={(repo, wfId) => { setActiveRepo(repo); setActiveWfId(wfId); }}>
                  <RunListPage onSelectWorkflow={handleSelectWorkflow} />
                </RouteWatcher>
              } />
              <Route path="/repo/:repo/wf/:wfId/run/:runId" element={
                <RouteWatcher onActive={(repo, wfId) => { setActiveRepo(repo); setActiveWfId(wfId); }}>
                  <StageViewPage />
                </RouteWatcher>
              } />
              <Route path="/releases" element={<ReleaseGroupsPage />} />
              <Route path="*" element={<div className="state-box"><span className="t1">Page not found</span></div>} />
            </Routes>
          </main>
        </div>
      </div>

      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      <ChangePasswordDialog open={changePwOpen} onClose={() => setChangePwOpen(false)} />
    </>
  );
}

// Syncs active repo/wf from URL params into parent state
function RouteWatcher({ onActive, children }) {
  const { repo, wfId } = useParams();
  React.useEffect(() => {
    if (repo && wfId) onActive(decodeURIComponent(repo), Number(wfId));
  }, [repo, wfId]);
  return children;
}

function AuthGate() {
  const { state, dispatch } = useApp();
  if (!state.auth) {
    return (
      <LoginDialog
        required
        open
        onSuccess={token => dispatch({ type: 'SET_AUTH', payload: token })}
        onClose={() => {}}
      />
    );
  }
  return <AppShell />;
}

export default function App() {
  return (
    <AppProvider>
      <AuthGate />
    </AppProvider>
  );
}
