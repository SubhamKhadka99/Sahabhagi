import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "../lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (u: Partial<User>) => void;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, login: () => {}, logout: () => {}, updateUser: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sb_user");
      if (raw) setUser(JSON.parse(raw) as User);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const login = useCallback((token: string, u: User) => {
    localStorage.setItem("sb_token", token);
    localStorage.setItem("sb_user", JSON.stringify(u));
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sb_token");
    localStorage.removeItem("sb_user");
    setUser(null);
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      localStorage.setItem("sb_user", JSON.stringify(next));
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout, updateUser }}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx);
