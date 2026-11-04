import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  Auth0Context,
  Auth0Provider,
  type AppState,
  type Auth0ContextInterface,
  type RedirectLoginOptions,
} from "@auth0/auth0-react";
import { DEV_AUTH, devToken, loadDevUser, saveDevUser, type DevUser } from "./devAuth";

// Fills the same Auth0 context the app already reads through useAuth0(),
// so no component needs to know whether dev auth is on.
const DevAuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [devUser, setDevUser] = useState<DevUser | null>(loadDevUser);

  const loginWithRedirect = useCallback(
    async (options?: RedirectLoginOptions<AppState>) => {
      const returnTo = options?.appState?.returnTo || "/setup";
      navigate(`/dev-login?returnTo=${encodeURIComponent(returnTo)}`);
    },
    [navigate]
  );

  const value = useMemo(() => {
    const signIn = (user: DevUser) => {
      saveDevUser(user);
      setDevUser(user);
    };
    return {
      isAuthenticated: !!devUser,
      isLoading: false,
      error: undefined,
      user: devUser
        ? { email: devUser.email, name: devUser.name, given_name: devUser.name, sub: `dev|${devUser.email}` }
        : undefined,
      loginWithRedirect,
      logout: async () => {
        saveDevUser(null);
        setDevUser(null);
        navigate("/");
      },
      getAccessTokenSilently: async () => {
        if (!devUser) throw new Error("Not signed in (dev auth)");
        return devToken(devUser);
      },
      devSignIn: signIn,
    } as unknown as Auth0ContextInterface & { devSignIn: (user: DevUser) => void };
  }, [devUser, loginWithRedirect, navigate]);

  return <Auth0Context.Provider value={value}>{children}</Auth0Context.Provider>;
};

const RealAuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState?: AppState) => {
    navigate(appState?.returnTo || "/setup", { replace: true });
  };

  return (
    <Auth0Provider
      domain={import.meta.env.VITE_authDomain}
      clientId={import.meta.env.VITE_authClientID}
      authorizationParams={{
        redirect_uri: import.meta.env.VITE_redirectURL,
        audience: import.meta.env.VITE_authApiAudience,
        scope: "openid profile email",
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
};

const AuthProvider = DEV_AUTH ? DevAuthProvider : RealAuthProvider;

export default AuthProvider;
