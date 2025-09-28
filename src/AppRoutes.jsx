import { React, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import Home from "./pages/Home.jsx";
import Transactions from "./pages/Transactions";
import { useAuth0 } from "@auth0/auth0-react";
import Landing from "./pages/Landing.jsx";
import UserSetup from "./pages/UserSetup.jsx";
import { addAccessTokenInterceptor } from "./../api/axios";
import Sidebar from "./components/Sidebar.jsx";
import Transaction_Detailed from "./pages/Transaction_Detailed.jsx";
import FourOFour from "./pages/FourOFour.jsx";

const AppRoutes = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  console.log("isAuthenticated: ", isAuthenticated);
  const accessToken = getAccessTokenSilently;
  useEffect(() => {
    addAccessTokenInterceptor(accessToken);
  }, [getAccessTokenSilently]);

  const notAuthenticated = () =>{
    //shows message, prompts user to log in again
    
  }

  return (
    <div className="flex flex-1 h-screen w-screen overflow-x-hidden">
      <Sidebar className="" />
      <Routes>
        <Route path="/" element={<Landing />} />
        {isAuthenticated ? (
          <>
            <Route path="/home/:sqid" element={<Home />} />
            <Route path="/transactions/:sqid" element={<Transactions />} />
            <Route
              path="/transactions/:sqid/:transaction_uuid"
              element={<Transaction_Detailed />}
            />
            <Route path="/setup" element={<UserSetup />} />
          </>
        ) : null}
        <Route path="*" element={<FourOFour />} />
      </Routes>
    </div>
  );
};

export default AppRoutes;
