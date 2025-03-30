import React from 'react';
import { BrowserRouter } from 'react-router';
import { useNavigate } from 'react-router';
import { Auth0Provider } from '@auth0/auth0-react';
import { HeroUIProvider } from '@heroui/react';
import AppRoutes from './AppRoutes.jsx';

const AppProvider = () => {
  const navigate = useNavigate();

  const onRedirectCallback = (appState) => {
    navigate(appState?.returnTo || window.location.pathname);
  };

  return (
    <Auth0Provider
      domain={process.env.VITE_authDomain}
      clientId={process.env.vite_authClientID}
      authorizationParams={{ redirect_uri: `${process.env.VITE_redirectURL}` }}
      onRedirectCallback={onRedirectCallback}
    >
      <HeroUIProvider>
        <AppRoutes />
      </HeroUIProvider>
    </Auth0Provider>
  );
};

const App = () => (
  <BrowserRouter>
    <AppProvider />
  </BrowserRouter>
);

export default App;
