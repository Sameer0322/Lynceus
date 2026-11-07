import React, { useState, useEffect, useRef } from 'react';
import { apiLogin } from '../../services/api.js';
import { useApp } from '../../context/AppContext.jsx';

export default function LoginDialog({ open, onClose, onSuccess, required = false }) {
  const { dispatch } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUsername(''); setPassword(''); setError(''); setLoading(false);
      setTimeout(() => userRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) { setError('Username and password are required.'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await apiLogin(username, password);
      dispatch({ type: 'SET_AUTH', payload: data.token });
      if (onSuccess) onSuccess(data.token);
      if (!required) onClose(true);
    } catch (e) {
      setError(e.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="overlay"
      onClick={e => { if (!required && e.target === e.currentTarget) onClose(false); }}
    >
      <div className="modal">
        <div className="modal-title">{required ? 'Lynceaus' : 'Admin Login'}</div>
        <div className="modal-sub">{required ? 'Sign in to continue' : 'Admin credentials required'}</div>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input
              ref={userRef}
              className="finput"
              type="text"
              placeholder="your username"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="finput"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="form-error">{error}</div>}
          <button className="btn-save" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
