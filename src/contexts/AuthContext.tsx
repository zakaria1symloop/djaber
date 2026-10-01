'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  getProfile,
  logout as apiLogout,
  storeAuthData,
  getStoredUser,
  isAuthenticated as checkAuth,
  type LoginRequest,
  type RegisterRequest,
  type AuthResponse,
} from '@/lib/api';
import { getLang, translateFor } from '@/lib/i18n';

// Providers sit above the React tree that renders these strings, so they are
// translated at throw-time with the stored language instead of a hook (adding
// one here would re-render the whole app on every language change).
const tr = (key: string) => translateFor(getLang(), key);

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<User>;
  register: (data: RegisterRequest) => Promise<User>;
  logout: () => void;
  clearError: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      try {
        const storedUser = getStoredUser();
        if (storedUser && checkAuth()) {
          setUser(storedUser);
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<User> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiLogin(credentials);
      storeAuthData(response.token, response.user);

      setUser(response.user);
      setIsAuthenticated(true);
      return response.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tr('shell.err.login');
      setError(errorMessage);
      throw err; // Re-throw so components can handle it
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterRequest): Promise<User> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiRegister(data);
      storeAuthData(response.token, response.user);

      setUser(response.user);
      setIsAuthenticated(true);
      return response.user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tr('shell.err.register');
      setError(errorMessage);
      throw err; // Re-throw so components can handle it
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    setIsAuthenticated(false);
    setError(null);
  };

  const clearError = () => {
    setError(null);
  };

  const refreshProfile = async () => {
    try {
      setLoading(true);
      const response = await getProfile();
      setUser(response.user);
      // Update localStorage so plan persists across reloads
      localStorage.setItem('user', JSON.stringify(response.user));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tr('shell.err.profile');
      setError(errorMessage);
      // If token is invalid, logout
      if (err instanceof Error && err.message.includes('token')) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated,
    login,
    register,
    logout,
    clearError,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
