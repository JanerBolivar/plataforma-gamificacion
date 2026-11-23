import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import AccountStatusView from './pages/AccountStatusView';
import AppLayout from './layouts/AppLayout';
import Welcome from './pages/Welcome';
import UsersPage from './pages/admin/UsersPage';
import MatchesPage from './pages/lobby/MatchesPage';
import MatchLobbyPage from './pages/lobby/MatchLobbyPage';
import GamePage from './pages/game/GamePage';
import CircoPage from './pages/game/CircoPage';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';

/**
 * Envoltorio para rutas que exigen sesion activa y perfil activo.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean; fullScreen?: boolean }> = ({
  children,
  adminOnly = false,
  fullScreen = false,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="w-full max-w-sm space-y-3">
          <Skeleton className="h-6 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.status === 'PENDING') {
    return <AccountStatusView status="PENDING" />;
  }

  if (user.status === 'BLOCKED') {
    return <AccountStatusView status="BLOCKED" />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  if (fullScreen) {
    return <>{children}</>;
  }

  return <AppLayout>{children}</AppLayout>;
};

/** Redireccion automatica de ruta legacy /game/:matchId a /game/:matchId/pantano */
const GameMatchRedirect: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  return <Navigate to={`/game/${matchId}/pantano`} replace />;
};

export const AppContent: React.FC = () => {
  const { user, isLoading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !isLoading && user && user.status === 'ACTIVE' ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Welcome />
          </ProtectedRoute>
        }
      />

      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <MatchesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/matches/:id"
        element={
          <ProtectedRoute>
            <MatchLobbyPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/game/:matchId/pantano"
        element={
          <ProtectedRoute fullScreen>
            <GamePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/game/:matchId"
        element={
          <ProtectedRoute fullScreen>
            <GameMatchRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/game/:matchId/circo"
        element={
          <ProtectedRoute fullScreen>
            <CircoPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
