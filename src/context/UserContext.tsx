import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth0 } from "@auth0/auth0-react";
import api, { setAccessTokenGetter } from "../lib/api";
import type { UserPreferences, UserRow } from "../lib/types";

type Status = "loading" | "signedOut" | "needsSetup" | "ready" | "error";

interface UserContextValue {
  status: Status;
  user: UserRow | null;
  sqid: string | null;
  monthlyBudget: number | null;
  refreshUser: () => Promise<void>;
  // Goes up by one whenever transactions change, so lists know to refetch.
  transactionsVersion: number;
  notifyTransactionsChanged: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

const parseBudget = (user: UserRow | null): number | null => {
  if (!user?.preference_json) return null;
  try {
    const monthly = (JSON.parse(user.preference_json) as UserPreferences).budgets?.monthly;
    if (monthly === undefined || monthly === "") return null;
    const budget = Number(monthly);
    return Number.isFinite(budget) ? budget : null;
  } catch {
    return null;
  }
};

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<UserRow | null>(null);
  const [transactionsVersion, setTransactionsVersion] = useState(0);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get<UserRow>("/user");
      if (res.status === 200 && res.data?.user_sqid) {
        setUser(res.data);
        setStatus("ready");
      } else {
        setUser(null);
        setStatus("needsSetup");
      }
    } catch (err) {
      console.error("Unable to load the signed-in user", err);
      setUser(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    setAccessTokenGetter(isAuthenticated ? () => getAccessTokenSilently() : null);
    if (isLoading) return;
    if (!isAuthenticated) {
      setUser(null);
      setStatus("signedOut");
      return;
    }
    setStatus("loading");
    refreshUser();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, refreshUser]);

  const notifyTransactionsChanged = useCallback(() => setTransactionsVersion((v) => v + 1), []);

  const value = useMemo<UserContextValue>(
    () => ({
      status,
      user,
      sqid: user?.user_sqid ?? null,
      monthlyBudget: parseBudget(user),
      refreshUser,
      transactionsVersion,
      notifyTransactionsChanged,
    }),
    [status, user, refreshUser, transactionsVersion, notifyTransactionsChanged]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrentUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside <UserProvider>");
  return ctx;
};
