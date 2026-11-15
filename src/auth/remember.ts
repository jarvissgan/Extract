// "Remember me": whether to stay logged in after the browser is closed.
//
// Remembered (the default): the login lasts until it expires, as usual.
// Not remembered: a session cookie (no expiry date, so the browser deletes it when it
// closes, and it's shared by all tabs) marks this browser session. When the app starts
// without it, SessionGuard logs out, which also ends the Auth0 session.
import { useEffect, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const REMEMBER_KEY = "extract-remember-me";
const SESSION_COOKIE = "extract_session";

export const getRemember = () => {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return true;
  }
};

export const setRemember = (remember: boolean) => {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    // storage unavailable: the browser can't remember the login anyway
  }
  if (!remember) markBrowserSession();
};

const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
export const markBrowserSession = () => {
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax${secure}`;
};
const browserSessionAlive = () => document.cookie.split("; ").some((c) => c === `${SESSION_COOKIE}=1`);

// True when this login wasn't to be remembered and the browser has been closed since.
export const shouldForget = () => !getRemember() && !browserSessionAlive();

// Logs out a login that wasn't to be remembered once the browser has been restarted.
export const SessionGuard = ({ children }: { children: ReactNode }) => {
  const { isLoading, isAuthenticated, logout } = useAuth0();
  const [forgetting, setForgetting] = useState(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (shouldForget()) {
      setForgetting(true);
      logout({ logoutParams: { returnTo: window.location.origin } });
    } else if (!getRemember()) {
      markBrowserSession();
    }
  }, [isLoading, isAuthenticated, logout]);

  // hidden only until the logout has happened, so nothing of the old session flashes up
  return forgetting && isAuthenticated ? null : children;
};
