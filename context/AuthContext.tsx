// context/AuthContext.tsx

'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { login as apiLogin } from '@/lib/api';

// Интерфейс для данных, которые мы извлекаем из токена
interface DecodedToken {
  userId: string | null;
  isAdmin: boolean;
  exp: number;
}

// Наша собственная функция для декодирования токена
const decodeToken = (token: string): DecodedToken | null => {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;

    // Декодируем payload из Base64 в строку JSON
    const decodedJsonPayload = atob(payloadBase64);

    // Используем JSON.parse для извлечения isAdmin и exp
    const payload = JSON.parse(decodedJsonPayload);

    // А теперь самое главное: извлекаем user_id как СТРОКУ с помощью Regex,
    // чтобы избежать проблемы с точностью чисел в JavaScript.
    const userIdMatch = decodedJsonPayload.match(/"user_id":(\d+)/);
    const userId = userIdMatch ? userIdMatch[1] : null;

    return {
      userId: userId,
      isAdmin: payload.is_admin || false,
      exp: payload.exp || 0,
    };
  } catch (error) {
    console.error("Failed to decode token", error);
    return null;
  }
};


interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  userId: string | null; // ID теперь строка
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ isAdmin: boolean }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null); // ID теперь строка
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      const decoded = decodeToken(storedToken);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setToken(storedToken);
        setIsAdmin(decoded.isAdmin);
        setUserId(decoded.userId);
      } else {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await apiLogin(username, password);
    const decoded = decodeToken(data.token);
    if (!decoded) {
        throw new Error("Failed to decode token on login");
    }
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setIsAdmin(decoded.isAdmin);
    setUserId(decoded.userId);
    return { isAdmin: decoded.isAdmin };
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAdmin(false);
    setUserId(null);
  };

  const authContextValue = {
    isAuthenticated: !!token,
    isAdmin,
    userId,
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