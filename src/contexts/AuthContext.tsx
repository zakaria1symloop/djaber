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

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
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

  const login = async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiLogin(credentials);
      storeAuthData(response.token, response.user);

      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err; // Re-throw so components can handle it
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: RegisterRequest) => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiRegister(data);
      storeAuthData(response.token, response.user);

      setUser(response.user);
      setIsAuthenticated(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
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
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch profile';
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
