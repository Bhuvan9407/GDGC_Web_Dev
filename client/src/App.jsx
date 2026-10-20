import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import CataloguePage from './pages/CataloguePage';
import CustomerDashboard from './pages/CustomerDashboard';
import StudioDashboard from './pages/StudioDashboard';
import LoadingSpinner from './components/LoadingSpinner';
import { api } from './api';

export default function App() {
  const [user, setUser] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [activeView, setActiveView] = useState('catalogue');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Check persistent session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await api.auth.getMe();
        if (res.user) {
          setUser(res.user);
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setLoadingSession(false);
      }
    }
    checkAuth();
  }, []);

  // Handle Logout
  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setActiveView('catalogue');
    }
  }

  // Handle Auth Success
  function handleAuthSuccess(newUser) {
    setUser(newUser);
    if (newUser.role === 'studio') {
      setActiveView('studio-dashboard');
    } else {
      setActiveView('catalogue');
    }
  }

  if (loadingSession) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner message="Connecting to KalaKriti Art Studio..." />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar
        user={user}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />

      <main className="main-content">
        {activeView === 'catalogue' && (
          <CataloguePage
            user={user}
            onAuthRequired={() => setIsAuthModalOpen(true)}
            onNavigateToOrders={() => setActiveView('customer-dashboard')}
          />
        )}

        {activeView === 'customer-dashboard' && user && user.role === 'customer' && (
          <CustomerDashboard user={user} />
        )}

        {activeView === 'studio-dashboard' && user && user.role === 'studio' && (
          <StudioDashboard user={user} />
        )}

        {/* Fallback if unauthorized view requested */}
        {activeView === 'customer-dashboard' && (!user || user.role !== 'customer') && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <h2 className="title-large" style={{ color: 'var(--md-sys-color-error)', marginBottom: '1rem' }}>
              Authentication Required
            </h2>
            <p className="body-medium" style={{ marginBottom: '1.5rem' }}>
              Please sign in with a customer account to access this dashboard.
            </p>
            <button
              type="button"
              className="md-btn md-btn-filled"
              onClick={() => setIsAuthModalOpen(true)}
            >
              Sign In
            </button>
          </div>
        )}

        {activeView === 'studio-dashboard' && (!user || user.role !== 'studio') && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <h2 className="title-large" style={{ color: 'var(--md-sys-color-error)', marginBottom: '1rem' }}>
              Access Forbidden
            </h2>
            <p className="body-medium" style={{ marginBottom: '1.5rem' }}>
              Studio administrative privileges are required to view this page.
            </p>
            <button
              type="button"
              className="md-btn md-btn-outlined"
              onClick={() => setActiveView('catalogue')}
            >
              Return to Gallery
            </button>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-primary)' }}>
              palette
            </span>
            <strong style={{ color: 'var(--md-sys-color-primary)', fontSize: '1rem' }}>KalaKriti Art Studio</strong>
          </div>
          <p className="body-medium" style={{ color: 'var(--md-sys-color-outline)' }}>
            Google Developer Groups on Campus (GDGC) Web Development Project • Handcrafted with Material Design 3
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
            Preserving traditional Indian art forms: Madhubani, Warli, Tanjore, Pattachitra, Kalamkari, Gond, Cheriyal, and Nirmal.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
