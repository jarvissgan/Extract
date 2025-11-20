import React from "react";
import { BrowserRouter } from "react-router";
import { useNavigate } from "react-router";
import { Auth0Provider } from "@auth0/auth0-react";
import AppRoutes from "./AppRoutes.jsx";
import { MantineProvider, Notification } from "@mantine/core";

const AppProvider = () => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || window.location.pathname);
  };

  return (
    <Auth0Provider
      domain={process.env.VITE_authDomain}
      clientId={process.env.vite_authClientID}
      authorizationParams={{
        redirect_uri: `${process.env.VITE_redirectURL}`,
        audience: `${process.env.VITE_authApiAudience}`,
      }}
      onRedirectCallback={onRedirectCallback}
      useRefreshTokens={true}
      cacheLocation={"localstorage"}>
      <MantineProvider>
        <Notification />
        <main className="">
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
