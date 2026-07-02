import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useMutation, useLazyQuery } from "@apollo/client";
import {
  LOGIN_MUTATION,
  REGISTER_MUTATION,
  REFRESH_TOKENS_MUTATION,
  ME_QUERY,
} from "../lib/graphql";
import { apolloClient } from "./ApolloProvider";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [loginMutation] = useMutation(LOGIN_MUTATION);
  const [registerMutation] = useMutation(REGISTER_MUTATION);
  const [refreshMutation] = useMutation(REFRESH_TOKENS_MUTATION);
  const [fetchMe] = useLazyQuery(ME_QUERY);

  const storeTokens = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
  }, []);

  const clearTokens = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
  }, []);

  const tryRefresh = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return false;
    try {
      const { data } = await refreshMutation({
        variables: { refreshToken },
      });
      if (data?.refreshTokens) {
        storeTokens(data.refreshTokens.accessToken, data.refreshTokens.refreshToken);
        return true;
      }
    } catch {
      // refresh failed
    }
    return false;
  }, [refreshMutation, storeTokens]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await fetchMe();
        if (data?.me) {
          setUser(data.me);
        } else {
          const refreshed = await tryRefresh();
          if (refreshed) {
            const { data: retryData } = await fetchMe();
            if (retryData?.me) setUser(retryData.me);
          }
        }
      } catch {
        const refreshed = await tryRefresh();
        if (refreshed) {
          try {
            const { data: retryData } = await fetchMe();
            if (retryData?.me) setUser(retryData.me);
          } catch {
            clearTokens();
          }
        } else {
          clearTokens();
        }
      }
      setLoading(false);
    };
    init();
  }, [fetchMe, tryRefresh, clearTokens]);

  const login = async (email: string, password: string) => {
    const { data } = await loginMutation({ variables: { email, password } });
    if (data?.login) {
      storeTokens(data.login.tokens.accessToken, data.login.tokens.refreshToken);
      setUser(data.login.user);
    }
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => {
    const { data } = await registerMutation({
      variables: { email, password, firstName, lastName },
    });
    if (data?.register) {
      storeTokens(data.register.tokens.accessToken, data.register.tokens.refreshToken);
      setUser(data.register.user);
    }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    apolloClient.clearStore();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
