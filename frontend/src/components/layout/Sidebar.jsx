import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { shortRepo } from '../../utils.js';

export default function Sidebar({ activeRepo, activeWfId, onSelectWorkflow, onNavigateHome }) {
  const { state } = useApp();
  const [collapsedTeams, setCollapsedTeams] = useState(new Set());
  const [openRepos, setOpenRepos] = useState(new Set());

  // Auto-open the active repo
  useEffect(() => {
    if (activeRepo) {
      setOpenRepos(prev => {
        if (prev.has(activeRepo)) return prev;
        const next = new Set(prev);
        next.add(activeRepo);
        return next;
      });
    }
  }, [activeRepo]);

  function toggleTeam(idx) {
    setCollapsedTeams(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleRepo(repo) {
    setOpenRepos(prev => {
      const next = new Set(prev);
      if (next.has(repo)) next.delete(repo);
      else next.add(repo);
      return next;
    });
  }

  // Only show teams in selectedTeams
  const visibleTeams = state.teams
    .map((team, idx) => ({ team, idx }))
    .filter(({ idx }) => state.selectedTeams.has(idx));

  if (visibleTeams.length === 0) return <aside className="sidebar"><div id="repoTree" /></aside>;

  return (
    <aside className="sidebar">
      <div id="repoTree">
        {visibleTeams.map(({ team, idx }) => {
          const collapsed = collapsedTeams.has(idx);
          const repos = (team.repos || []).map(r => typeof r === 'string' ? r : r.repo);
          return (
            <div className="sidebar-team-group" key={idx}>
              <div className="sidebar-team-label" onClick={() => toggleTeam(idx)}>
                <span className={`sidebar-team-chevron${collapsed ? '' : ' open'}`}>▶</span>
                {team.name}
              </div>
              {!collapsed && repos.map(repo => {
                const rd = state.repoData[repo] || {};
                const workflows = rd.workflows || [];
                const isOpen = openRepos.has(repo);
                return (
                  <div key={repo}>
                    <div
                      className={`tree-repo-header${activeRepo === repo ? ' active' : ''}`}
                      onClick={() => toggleRepo(repo)}
                    >
                      <span className={`chevron${isOpen ? ' open' : ''}`}>▶</span>
                      <span className="repo-name-label" title={repo}>{shortRepo(repo)}</span>
                    </div>
                    <div className={`tree-wf-list${isOpen ? ' open' : ''}`}>
                      {workflows.map(wf => {
                        const isActive = activeRepo === repo && activeWfId === wf.id;
                        return (
                          <div
                            key={wf.id}
                            className={`tree-wf-item${isActive ? ' active' : ''}`}
                            onClick={() => onSelectWorkflow(repo, wf.id)}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={wf.name}>
                              {wf.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
