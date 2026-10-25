import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/client';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean, portalMode?: 'workspace' | 'developer_console') => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (resource: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { success, error } = useToast();

  const refreshUser = async () => {
    try {
      const res = await api.getMe();
      if (res.user) {
        setUser(res.user);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (identifier: string, password: string, rememberMe = false, portalMode: 'workspace' | 'developer_console' = 'workspace') => {
    try {
      const res = await api.login({ identifier, password, rememberMe, portalMode });
      setUser({ ...res.user, portalMode });
      if (portalMode === 'developer_console') {
        success('Developer Console Authenticated', `Welcome to the Platform Developer Console, ${res.user.name}`);
      } else {
        success('Signed in successfully', `Welcome back, ${res.user.name}`);
      }
    } catch (err: any) {
      error('Authentication Failed', err.message);
      throw err;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const res = await api.register({ name, email, password });
      setUser(res.user);
      success('Account Created', `Welcome to TaskFlow, ${name}`);
    } catch (err: any) {
      error('Registration Failed', err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Continue client logout even if network error
    } finally {
      setUser(null);
      success('Logged out', 'You have been safely signed out');
    }
  };

  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.effectivePermissions?.isSuperAdmin || user.effectivePermissions?.allAllowed || user.effectivePermissions?.roleEnforcementDisabled) return true;

    // Check user overrides
    const override = user.effectivePermissions?.userOverrides?.find(
      o => o.resource === resource && o.action === action
    );
    if (override) {
      return override.is_granted === 1;
    }

    // Check role permissions
    const hasRolePerm = user.effectivePermissions?.rolePermissions?.some(
      p => p.resource === resource && p.action === action
    );
    return !!hasRolePerm;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

