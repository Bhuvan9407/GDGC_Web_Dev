import React, { useState } from 'react';
import Modal from './Modal';
import { api } from '../api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  function resetState() {
    setError('');
    setLoading(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login({ email: loginEmail, password: loginPassword });
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.register({
        name: regName,
        email: regEmail,
        password: regPassword,
      });
      onAuthSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  function fillStudioDemo() {
    setLoginEmail('studio@artstudio.in');
    setLoginPassword('Studio@123');
    setError('');
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tab === 'login' ? 'Sign In to Art Studio' : 'Create Customer Account'}
    >
      {/* Tab Switcher */}
      <div className="md-tabs" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={`md-tab ${tab === 'login' ? 'active' : ''}`}
          onClick={() => {
            setTab('login');
            resetState();
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            login
          </span>
          Sign In
        </button>
        <button
          type="button"
          className={`md-tab ${tab === 'register' ? 'active' : ''}`}
          onClick={() => {
            setTab('register');
            resetState();
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            person_add
          </span>
          Customer Register
        </button>
      </div>

      {error && (
        <div className="md-banner md-banner-error" style={{ marginBottom: '1rem', padding: '0.65rem 0.85rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            error
          </span>
          <span style={{ fontSize: '0.8125rem' }}>{error}</span>
        </div>
      )}

      {/* LOGIN TAB */}
      {tab === 'login' && (
        <form onSubmit={handleLogin}>
          <div className="md-form-group">
            <label className="md-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="md-input"
              required
              placeholder="e.g., customer@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="md-input"
              required
              placeholder="Enter your password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="submit" className="md-btn md-btn-filled" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Quick Demo Credentials helper */}
            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                borderRadius: 'var(--md-shape-corner-small)',
                fontSize: '0.75rem',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            >
              <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
                Quick Test Credentials:
              </span>
              <button
                type="button"
                className="md-btn md-btn-sm md-btn-tonal"
                onClick={fillStudioDemo}
                style={{ width: '100%', marginBottom: '0.25rem' }}
              >
                Use Seeded Studio Admin (studio@artstudio.in)
              </button>
            </div>
          </div>
        </form>
      )}

      {/* REGISTER TAB */}
      {tab === 'register' && (
        <form onSubmit={handleRegister}>
          <div className="md-form-group">
            <label className="md-label" htmlFor="reg-name">
              Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              className="md-input"
              required
              placeholder="e.g., Ananya Sharma"
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label" htmlFor="reg-email">
              Email Address
            </label>
            <input
              id="reg-email"
              type="email"
              className="md-input"
              required
              placeholder="name@example.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="md-form-group">
            <label className="md-label" htmlFor="reg-password">
              Password (min. 6 characters)
            </label>
            <input
              id="reg-password"
              type="password"
              className="md-input"
              required
              minLength={6}
              placeholder="Create a secure password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <p className="md-help-text" style={{ marginBottom: '1rem' }}>
            Note: Public registration creates a customer account. Studio accounts are restricted and pre-seeded.
          </p>

          <button type="submit" className="md-btn md-btn-filled" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Creating Account...' : 'Register as Customer'}
          </button>
        </form>
      )}
    </Modal>
  );
}
