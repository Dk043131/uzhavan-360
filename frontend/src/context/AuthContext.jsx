import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, tokenStore, setUnauthorizedHandler } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(() => tokenStore.getUser());
  const [restoring, setRestoring] = useState(() => Boolean(tokenStore.get()));

  const signOut = useCallback(async () => {
    try {
      if (tokenStore.get()) {
        await authApi.logout();
      }
    } catch {
      // Always proceed to clear local state even if backend API fails or offline
    } finally {
      tokenStore.clear();
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const logout = signOut;

  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.clear();
      setUser(null);
      queryClient.clear();
    });
  }, [queryClient]);

  // Session restoration against the real backend
  useEffect(() => {
    if (!tokenStore.get()) { setRestoring(false); return; }
    authApi.me().then(({ user: fresh }) => { tokenStore.setUser(fresh); setUser(fresh); }).catch(() => {}).finally(() => setRestoring(false));
  }, []);

  const applySession = useCallback(({ user: u, token }) => { tokenStore.set(token); tokenStore.setUser(u); setUser(u); return u; }, []);
  const login = useCallback(async (data) => applySession(await authApi.login(data)), [applySession]);
  const register = useCallback(async (data) => applySession(await authApi.register(data)), [applySession]);
  const refreshUser = useCallback(async () => { const { user: fresh } = await authApi.me(); tokenStore.setUser(fresh); setUser(fresh); return fresh; }, []);

  const value = useMemo(() => ({
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    restoring,
    login,
    register,
    signOut,
    logout,
    refreshUser,
    setUser
  }), [user, restoring, login, register, signOut, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
export const homeFor = (role) => (role === "ROLE_FARMER" ? "/farmer" : role === "ROLE_ADMIN" ? "/admin" : "/");
