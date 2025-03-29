import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { HeroUIProvider } from "@heroui/react";
import { BrowserRouter, Routes, Route } from "react-router";
import { Auth0Provider } from "@auth0/auth0-react";
import Home from "./pages/Home.jsx";
import Transactions from "./pages/Transactions.jsx";

import Sidebar from "./components/sidebar.jsx";

createRoot(document.getElementById("root")).render(
  <Auth0Provider
    domain={process.env.VITE_authDomain}
    clientId={process.env.vite_authClientID}
    authorizationParams={{ redirect_uri: `${process.env.VITE_redirectURL}` }}>
    <BrowserRouter>
      <HeroUIProvider>
        <div className="flex h-screen w-screen ">
          <Sidebar className="basis-1/2" />
          <div className="grow">
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="home" element={<Home />} />
              <Route path="transactions" element={<Transactions />} />
            </Routes>
          </div>
        </div>
      </HeroUIProvider>
    </BrowserRouter>
  </Auth0Provider>
);
