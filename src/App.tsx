import { BrowserRouter, useNavigate } from "react-router";
import { Auth0Provider, type AppState } from "@auth0/auth0-react";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { UserProvider } from "./context/UserContext";
import AppRoutes from "./AppRoutes";

const AppProvider = () => {
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
      <MantineProvider defaultColorScheme="dark">
        <ModalsProvider>
          <Notifications />
          <UserProvider>
            <AppRoutes />
          </UserProvider>
        </ModalsProvider>
      </MantineProvider>
    </Auth0Provider>
  );
};

const App = () => (
  <BrowserRouter>
    <AppProvider />
  </BrowserRouter>
);

export default App;
