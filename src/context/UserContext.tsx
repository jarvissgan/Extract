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
import { currencySymbol, makeMoneyFormatter } from "../lib/transactions";
import { parseJson, type CategoryOption, type UserPreferences, type UserRow } from "../lib/types";
import { userCategories } from "../../shared/schemas.js";

type Status = "loading" | "signedOut" | "needsSetup" | "ready" | "error";

interface UserContextValue {
  status: Status;
  user: UserRow | null;
  sqid: string | null;
  preferences: UserPreferences;
  monthlyBudget: number | null;
  categories: CategoryOption[];
  currency: string;
  currencySymbol: string;
  formatMoney: (value: number) => string;
  refreshUser: () => Promise<void>;
  // Goes up by one whenever transactions change, so lists know to refetch.
  transactionsVersion: number;
  notifyTransactionsChanged: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isLoading, getAccessTokenSilently, user: authUser } = useAuth0();
  const authSub = authUser?.sub;
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
  }, [isAuthenticated, getAccessTokenSilently]);

  // Reload the account only when the signed-in person changes, not on every re-render
  // of the auth provider.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      setUser(null);
      setStatus("signedOut");
      return;
    }
    setStatus("loading");
    refreshUser();
  }, [isAuthenticated, isLoading, authSub, refreshUser]);

  const notifyTransactionsChanged = useCallback(() => setTransactionsVersion((v) => v + 1), []);

  const value = useMemo<UserContextValue>(() => {
    const preferences = parseJson<UserPreferences>(user?.preference_json, {});
    const monthly = preferences.budgets?.monthly;
    const currency = preferences.currency || "USD";
    return {
      status,
      user,
      sqid: user?.user_sqid ?? null,
      preferences,
      monthlyBudget: monthly === undefined || monthly === "" || !Number.isFinite(Number(monthly)) ? null : Number(monthly),
      categories: userCategories(preferences),
      currency,
      currencySymbol: currencySymbol(currency),
      formatMoney: makeMoneyFormatter(currency),
      refreshUser,
      transactionsVersion,
      notifyTransactionsChanged,
    };
  }, [status, user, refreshUser, transactionsVersion, notifyTransactionsChanged]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCurrentUser = () => {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside <UserProvider>");
  return ctx;
};
