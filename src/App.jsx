import { BrowserRouter, useNavigate } from "react-router";
import { Auth0Provider } from "@auth0/auth0-react";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import AppRoutes from "./AppRoutes.jsx";

const AppProvider = () => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || window.location.pathname);
  };

  return (
    <Auth0Provider
      domain={import.meta.env.VITE_authDomain}
      clientId={import.meta.env.vite_authClientID}
      authorizationParams={{
        redirect_uri: `${import.meta.env.VITE_redirectURL}`,
        audience: `${import.meta.env.VITE_authApiAudience}`,
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens
      cacheLocation="localstorage"
    >
      <MantineProvider defaultColorScheme="dark">
        <Notifications />
        <main>
          <AppRoutes />
        </main>
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
