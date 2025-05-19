import { React, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import Home from "./pages/Home.jsx";
import Transactions from "./pages/Transactions";
import { useAuth0 } from "@auth0/auth0-react";
import Landing from "./pages/Landing.jsx";
import UserSetup from "./pages/UserSetup.jsx";
import { addAccessTokenInterceptor } from "./../api/axios";
import Sidebar from "./components/Sidebar.jsx";

const AppRoutes = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  console.log("isAuthenticated: ", isAuthenticated);
  const accessToken = getAccessTokenSilently;
  useEffect(() => {
    addAccessTokenInterceptor(accessToken);
  }, [getAccessTokenSilently]);

  return (
    <div className="flex flex-1 h-screen w-screen overflow-x-hidden">
      <Sidebar className="" />
        <Routes>
          <Route path="/" element={<Landing />} />
          {isAuthenticated ? (
            <>
              <Route path="/home/:sqid" element={<Home />} />
              <Route path="/transactions/:sqid" element={<Transactions />} />
              <Route path="/setup" element={<UserSetup />} />
            </>
          ) : (
            <Route path="*" element={<p>Not Found</p>} />
          )}
        </Routes>
      </div>
  );
};

export default AppRoutes;
