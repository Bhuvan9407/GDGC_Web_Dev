import React from 'react';

export default function Navbar({ user, activeView, setActiveView, onOpenAuth, onLogout }) {
  return (
    <header className="md-top-app-bar">
      <div className="md-top-app-bar-inner">
        <div
          className="brand-logo"
          onClick={() => setActiveView('catalogue')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveView('catalogue')}
        >
          <span className="material-symbols-outlined brand-icon">
            palette
          </span>
          <div>
            <span className="brand-title">KalaKriti</span>
            <span style={{ fontSize: '0.75rem', display: 'block', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Art Studio
            </span>
          </div>
        </div>

        <nav className="nav-links" aria-label="Main Navigation">
          <button
            type="button"
            className={`md-btn md-btn-sm ${activeView === 'catalogue' ? 'md-btn-tonal' : 'md-btn-text'}`}
            onClick={() => setActiveView('catalogue')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              art_track
            </span>
            Gallery
          </button>

          {/* Customer Dashboard Link */}
          {user && user.role === 'customer' && (
            <button
              type="button"
              className={`md-btn md-btn-sm ${activeView === 'customer-dashboard' ? 'md-btn-tonal' : 'md-btn-text'}`}
              onClick={() => setActiveView('customer-dashboard')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                dashboard
              </span>
              My Dashboard
            </button>
          )}

          {/* Studio Admin Dashboard Link */}
          {user && user.role === 'studio' && (
            <button
              type="button"
              className={`md-btn md-btn-sm ${activeView === 'studio-dashboard' ? 'md-btn-tonal' : 'md-btn-text'}`}
              onClick={() => setActiveView('studio-dashboard')}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                admin_panel_settings
              </span>
              Studio Admin
            </button>
          )}

          {/* User state and actions */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--md-sys-color-on-surface)' }}>
                  {user.name}
                </span>
                <span className="md-role-chip">
                  <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>
                    {user.role === 'studio' ? 'verified_user' : 'person'}
                  </span>
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                className="md-btn md-btn-sm md-btn-outlined"
                onClick={onLogout}
                title="Log out"
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  logout
                </span>
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="md-btn md-btn-sm md-btn-filled"
              onClick={onOpenAuth}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                account_circle
              </span>
              Sign In
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
