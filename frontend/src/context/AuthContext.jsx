/**
 * AuthContext — global login state for the whole app.
 *
 * Wraps the app (see main.jsx) and exposes via useAuth():
 *   token, user, role, loading, isAuthenticated, login(), logout(), hasRole()
 *
 * The session is kept in sessionStorage (per browser tab — see
 * utils/authStorage.js), and the JWT expiry is watched so the user is
 * logged out automatically when the token runs out.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../api';
import { getToken, getStoredUser, setSession, setStoredUser, clearSession } from '../utils/authStorage';

const AuthContext = createContext(null);

// Read the payload part of a JWT (base64) without any library.
const decodeJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (error) {
    return null;
  }
};

// Provider — owns the token/user state for the whole app.
export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(getToken);
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(Boolean(token));

  // Clear the session everywhere.
  const logout = () => {
    clearSession();
    setToken(null);
    setUser(null);
  };

  // Save token + user to storage and state together.
  const persistSession = (nextToken, nextUser) => {
    setSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  };

  // Sign in via the API and store the session.
  const login = async (credentials) => {
    const data = await authService.login(credentials.email, credentials.password);
    persistSession(data.token, data.user);
    return data;
  };

  // axiosInstance fires this event on any 401 response → force logout.
  useEffect(() => {
    // Fired by axios on a 401 → force logout.
    const handleExpired = () => logout();
    window.addEventListener('medisync-auth-expired', handleExpired);
    return () => window.removeEventListener('medisync-auth-expired', handleExpired);
  }, []);

  // On page load / token change: confirm the stored token is still valid
  // by asking the API for the current user.
  useEffect(() => {
    // Confirm the stored token against the API.
    const verifySession = async () => {
      // No token stored → nothing to verify, show the login page.
      if (!token) {
        setLoading(false);
        return;
      }

      // Quick local check first: an expired token can be thrown away
      // without calling the API at all.
      const decoded = decodeJwt(token);
      if (!decoded?.exp || decoded.exp * 1000 <= Date.now()) {
        logout();
        setLoading(false);
        return;
      }

      // Token looks valid — ask the server who this user is. This also
      // refreshes the stored user after profile edits in another tab.
      try {
        const data = await authService.getMe();
        setUser(data.user);
        setStoredUser(data.user);
      } catch (error) {
        // Server rejected the token (revoked/expired) → log out.
        logout();
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, [token]);

  // Auto-logout timer: fires exactly when the JWT expires.
  useEffect(() => {
    if (!token) return undefined;
    const decoded = decodeJwt(token);
    if (!decoded?.exp) return undefined;

    // How many milliseconds until the token expires?
    const timeout = decoded.exp * 1000 - Date.now();
    if (timeout <= 0) {
      logout();
      return undefined;
    }

    // Log out exactly at expiry; cancel the timer if the token changes.
    const timer = window.setTimeout(logout, timeout);
    return () => window.clearTimeout(timer);
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      role: user?.role || null,
      loading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      hasRole: (...roles) => roles.includes(user?.role),
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook: read the auth state anywhere.
export const useAuth = () => useContext(AuthContext);
