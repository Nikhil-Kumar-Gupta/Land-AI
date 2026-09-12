import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, clearSession, getStoredBusiness, getToken, saveSession, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [business, setBusiness] = useState(() => (getToken() ? getStoredBusiness() : null));
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  const logout = useCallback(
    notice => {
      clearSession();
      setBusiness(null);
      navigate("/login", { replace: true, state: notice ? { notice } : undefined });
    },
    [navigate]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => logout("Your session has expired. Please sign in again."));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Validate a stored token once on load.
  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me", { redirectOn401: false })
      .then(b => {
        setBusiness(b);
        saveSession(getToken(), b);
      })
      .catch(() => {
        clearSession();
        setBusiness(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback((token, b) => {
    saveSession(token, b);
    setBusiness(b);
  }, []);

  return (
    <AuthContext.Provider value={{ business, checking, isAuthenticated: Boolean(business), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
