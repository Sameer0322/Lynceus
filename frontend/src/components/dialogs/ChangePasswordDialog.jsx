import React, { useState, useEffect, useRef } from 'react';
import { apiChangePassword } from '../../services/api.js';

export default function ChangePasswordDialog({ open, onClose }) {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const oldRef = useRef(null);

  useEffect(() => {
    if (open) {
      setOldPw(''); setNewPw(''); setConfirmPw(''); setError(''); setLoading(false);
      setTimeout(() => oldRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    setLoading(true);
    try {
      await apiChangePassword(oldPw, newPw);
      onClose(true);
    } catch (e) {
      setError(e.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className="modal">
        <div className="modal-title">Change Password</div>
        <div className="modal-sub">Update your account password</div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Current password</label>
            <input
              ref={oldRef}
              className="finput"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={oldPw}
              onChange={e => setOldPw(e.target.value)}
            />
          </div>
          <div className="field">
            <label>New password</label>
            <input
              className="finput"
              type="password"
              placeholder="min 6 characters"
              autoComplete="new-password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Confirm new password</label>
            <input
              className="finput"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
            />
          </div>
          {error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
          <div className="modal-actions">
            <button className="btn-save" type="submit" disabled={loading}>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
            <button className="btn-icon" type="button" onClick={() => onClose(false)}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
