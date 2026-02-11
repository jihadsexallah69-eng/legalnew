import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { ChatPage } from './pages/ChatPage';
import { CasesPage } from './pages/CasesPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SettingsPage } from './pages/SettingsPage';
import { TermsPage } from './pages/TermsPage';
import { AppProvider, useAppStore } from './lib/store';
import { Menu, ShieldAlert, X } from 'lucide-react';
import { Button } from './components/ui/Generic';
import { getNeonSession, neonSignOut } from './lib/neonAuth';

// Simple router component
const Router = () => {
  const authBypass = (import.meta.env.VITE_BYPASS_AUTH ?? 'false').toLowerCase() === 'true';
  const [page, setPage] = useState(authBypass ? 'chat' : 'landing');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { state, dispatch } = useAppStore();
  const [showDisclaimer, setShowDisclaimer] = useState(!state.disclaimerAccepted);

  useEffect(() => {
    if (authBypass) {
      setIsAuthenticated(true);
      setAuthChecked(true);
      return;
    }

    let alive = true;

    const syncSession = async () => {
      try {
        const session = await getNeonSession();
        const authed = Boolean(session?.session || session?.user);
        if (!alive) return;

        setIsAuthenticated(authed);
        if (authed) {
          setPage((prev) => (prev === 'landing' || prev === 'login' ? 'chat' : prev));
        } else {
          dispatch({ type: 'SET_CHATS', chats: [] });
        }
      } catch (err) {
        if (alive) {
          console.error('Session check failed:', err);
          setIsAuthenticated(false);
          dispatch({ type: 'SET_CHATS', chats: [] });
        }
      } finally {
        if (alive) setAuthChecked(true);
      }
    };

    syncSession();

    return () => {
      alive = false;
    };
  }, [authBypass]);

  useEffect(() => {
    // Sync with global store if needed, or check persistence
    if (state.disclaimerAccepted) {
      setShowDisclaimer(false);
    }
  }, [state.disclaimerAccepted]);

  useEffect(() => {
    // Theme handling
    const applyTheme = () => {
      const theme = state.theme;
      const root = window.document.documentElement;
      const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system changes if theme is system
    if (state.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [state.theme]);

  const handleDisclaimer = () => {
    dispatch({ type: 'ACCEPT_DISCLAIMER' });
    setShowDisclaimer(false);
  };

  const handleLogout = async () => {
    // Force logout state even in bypass mode
    setIsAuthenticated(false);
    setPage('landing');
    dispatch({ type: 'SET_CHATS', chats: [] });
    localStorage.removeItem('rcic-app-state');

    if (!authBypass) {
      try {
        await neonSignOut();
      } catch (err) {
        console.error('Sign-out failed:', err);
      }
    }
  };

  const handleLogin = async () => {
    const session = await getNeonSession();
    const authed = Boolean(session?.session || session?.user);
    if (!authed) {
      throw new Error('Login did not create a session. Check Neon Auth callback/origin configuration.');
    }
    setIsAuthenticated(true);
    setPage('chat');
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white text-slate-500">
        <div className="text-sm">Checking session...</div>
      </div>
    );
  }

  // Route Handlers
  if (!isAuthenticated || page === 'landing' || page === 'login' || page === 'terms') {
    if (page === 'login') {
      return <LoginPage onLogin={handleLogin} onBack={() => setPage('landing')} onNavigateToTerms={() => setPage('terms')} />;
    }
    if (page === 'terms') {
      return <TermsPage onBack={() => setPage('landing')} />;
    }
    // For landing page
    return <LandingPage onNavigate={(target) => setPage(target === 'login' ? 'login' : target === 'terms' ? 'terms' : 'landing')} />;
  }

  // App Layout for Authenticated Pages
  const renderAppPage = () => {
    switch (page) {
      case 'chat': return <ChatPage />;
      case 'cases': return <CasesPage />;
      case 'settings': return <SettingsPage />;
      default: return <div className="p-10 text-center text-slate-400">Page under construction: {page}</div>;
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden transition-colors duration-300">
      {/* Mobile Menu Button - Absolute */}
      <button 
        className="lg:hidden absolute top-3 left-3 z-[60] p-2 bg-slate-900 text-white rounded-md shadow-md"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <Sidebar 
        currentPage={page} 
        onNavigate={setPage} 
        isOpen={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col h-full overflow-hidden">
        {renderAppPage()}
        
        {/* Mobile Overlay for Sidebar */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </main>

      {/* Initial Disclaimer Modal - Only shown when in App Mode */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-white max-w-md w-full rounded-xl shadow-2xl p-6 border-t-4 border-blue-500">
            <div className="flex items-center gap-3 mb-4 text-blue-600">
              <ShieldAlert className="h-8 w-8" />
              <h2 className="text-xl font-bold">Important Disclaimer</h2>
            </div>
            <p className="text-slate-600 mb-4 text-sm leading-relaxed">
              This application is an AI-powered research assistant for RCICs. It provides information based on case law but 
              <strong> does not constitute legal advice</strong>.
            </p>
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              AI outputs can be inaccurate ("hallucinations"). You must verify all citations, paragraph numbers, and legal principles with official sources (CanLII, FC judgments) before using them in client submissions.
            </p>
            <Button onClick={handleDisclaimer} className="w-full font-bold">
              I Understand & Agree
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  );
}
