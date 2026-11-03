import { useEffect } from "react";
import { Routes, Route } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { AppShell } from "@mantine/core";
import { addAccessTokenInterceptor } from "./../api/axios";
import Sidebar from "./components/Sidebar.jsx";
import Home from "./pages/Home.jsx";
import Transactions from "./pages/Transactions";
import Landing from "./pages/Landing.jsx";
import UserSetup from "./pages/UserSetup.jsx";
import Transaction_Detailed from "./pages/Transaction_Detailed.tsx";
import FourOFour from "./pages/FourOFour.tsx";

const AppRoutes = () => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    addAccessTokenInterceptor(getAccessTokenSilently);
  }, [getAccessTokenSilently]);

  return (
    <AppShell navbar={{ width: 220, breakpoint: 0 }} padding={0}>
      <AppShell.Navbar p="md">
        <Sidebar />
      </AppShell.Navbar>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Landing />} />
          {isAuthenticated ? (
            <>
              <Route path="/home/:sqid" element={<Home />} />
              <Route path="/transactions/:sqid" element={<Transactions />} />
              <Route path="/transactions/:sqid/:transaction_uuid" element={<Transaction_Detailed />} />
              <Route path="/setup" element={<UserSetup />} />
            </>
          ) : null}
          <Route path="*" element={<FourOFour />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  );
};

export default AppRoutes;
