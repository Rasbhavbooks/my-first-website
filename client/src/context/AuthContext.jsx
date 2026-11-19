import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getReaderSession, loginReader, logoutReader } from "../services/authService.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const session = await getReaderSession();
      setUser(session?.user || null);
      return session?.user || null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getReaderSession()
      .then((session) => { if (active) setUser(session?.user || null); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (credentials) => {
    const result = await loginReader(credentials);
    setUser(result.user);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    await logoutReader();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, refreshSession }), [user, loading, signIn, signOut, refreshSession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
