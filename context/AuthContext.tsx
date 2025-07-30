'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin } from '@/lib/api';
import { jwtDecode } from 'jwt-decode';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ isAdmin: boolean }>;
  logout: () => void;
}

interface JwtPayload {
  is_admin: boolean;
  exp: number;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      const decoded = jwtDecode<JwtPayload>(storedToken);
      if (decoded.exp * 1000 > Date.now()) {
        setToken(storedToken);
        setIsAdmin(decoded.is_admin);
      } else {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    const decoded = jwtDecode<JwtPayload>(data.token);
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setIsAdmin(decoded.is_admin);
    return { isAdmin: decoded.is_admin };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAdmin(false);
  };

  const authContextValue = {
    isAuthenticated: !!token,
    isAdmin,
    token,
    loading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};
