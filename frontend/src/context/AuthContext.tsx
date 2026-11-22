import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthContextType } from '../types/auth';
import { authService } from '../services/user.service';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authService.getProfile();
      setUser(profile);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loginWithMicrosoft = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    window.location.href = `${apiUrl}/api/auth/microsoft`;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignorar error de red si ocurre durante el logout
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const updateAvatarModel = async (model: 'female' | 'man') => {
    await authService.updateAvatar(model);
    setUser((prev) => (prev ? { ...prev, avatarModel: model } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginWithMicrosoft,
        logout,
        refreshUser,
        updateAvatarModel,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
