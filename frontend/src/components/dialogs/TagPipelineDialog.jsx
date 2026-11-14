import React, { useState, useEffect, useRef } from 'react';
import { apiAddPipeline } from '../../services/api.js';
import { sha7, shortRepo } from '../../utils.js';
import { useApp } from '../../context/AppContext.jsx';

export default function TagPipelineDialog({ open, run, repo, groupId, groupName, onClose, onTagged }) {
  const { state } = useApp();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const noteRef = useRef(null);

  const addedBy = state.auth?.username || '';

  useEffect(() => {
    if (open) {
      setNote('');
      setError('');
      setLoading(false);
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        runId: String(run.id),
        repo: run.repository?.full_name || repo,
        branch: run.head_branch,
        runNumber: run.run_number,
        message: (run.head_commit?.message || '').split('\n')[0],
        addedBy: addedBy || 'Anonymous',
        iNumber: '',
        note: note.trim() || '',
      };
      const result = await apiAddPipeline(groupId, payload);
      onTagged?.(run.id, result.id, groupId, groupName);
      onClose(true);
    } catch (e) {
      setError(e.message || 'Failed to tag pipeline.');
    } finally {
      setLoading(false);
    }
  }

  if (!open || !run) return null;

  const commitMsg = (run.head_commit?.message || '').split('\n')[0];

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className="modal">
        <div className="modal-title">Tag Pipeline</div>
        <div className="modal-sub">
          <div className="tag-run-context">
            <strong>{groupName}</strong> &nbsp;·&nbsp;
            Run <strong>#{run.run_number}</strong> &nbsp;·&nbsp;
            Branch <strong>{run.head_branch}</strong><br />
            {commitMsg && <span>{commitMsg}</span>}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Added By</label>
            <div className="finput" style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--bg-secondary)', color: 'var(--text)',
              cursor: 'default', userSelect: 'none',
            }}>
              {addedBy}
            </div>
          </div>
          <div className="field">
            <label>Note <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              ref={noteRef}
              className="finput"
              rows={3}
              placeholder="Why is this being tagged for release?"
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>
          {error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
          <div className="modal-actions">
            <button className="btn-save" type="submit" disabled={loading}>
              {loading ? 'Tagging…' : 'Tag Pipeline'}
            </button>
            <button className="btn-icon" type="button" onClick={() => onClose(false)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
