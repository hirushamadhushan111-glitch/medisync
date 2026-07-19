// Per-tab auth storage. sessionStorage keeps each browser tab's login
// independent, so admin/doctor/staff/patient can be open in separate tabs
// of the same browser without overwriting each other's token.
const TOKEN_KEY = 'medisync_token';
const USER_KEY = 'medisync_user';

// One-time cleanup of tokens saved by the old localStorage-based sessions,
// so a stale shared token can never leak into a tab again.
try {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
} catch (error) {
  // storage unavailable (e.g. privacy mode) — nothing to clean
}

// Current tab's login token (or null).
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);

// Current tab's stored user object (cleared if corrupted).
export const getStoredUser = () => {
  try {
    const stored = sessionStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    clearSession();
    return null;
  }
};

// Save token + user for this tab.
export const setSession = (token, user) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Update just the stored user (e.g. after a profile edit).
export const setStoredUser = (user) => {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Remove this tab's login.
export const clearSession = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};
