import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell, Badge, Box, Center, Group, Loader } from "@mantine/core";
import Logo from "./components/Logo";
import AppearanceToggle from "./components/AppearanceToggle";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";
import AccountMenu from "./components/AccountMenu";
import { useCurrentUser } from "./context/UserContext";
import { useIsMobile } from "./hooks/useIsMobile";
import { RequireAccount, RequireAuth } from "./components/RouteGuards";
import { DEV_AUTH } from "./auth/devAuth";

const Landing = lazy(() => import("./pages/Landing"));
const Home = lazy(() => import("./pages/Home"));
const Transactions = lazy(() => import("./pages/Transactions"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail"));
const UserSetup = lazy(() => import("./pages/UserSetup"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Savings = lazy(() => import("./pages/Savings"));
const NotFound = lazy(() => import("./pages/NotFound"));
// only bundled on the dev server with VITE_AUTH_MODE=dev
const DevLogin = DEV_AUTH ? lazy(() => import("./pages/DevLogin")) : null;

const PageLoader = () => (
  <Center h="60vh">
    <Loader />
  </Center>
);

const AppRoutes = () => {
  const isMobile = useIsMobile();
  const { status } = useCurrentUser();
  // phones: bottom tab bar instead of the sidebar
  const showTabs = isMobile && status === "ready";

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: true } }}
      footer={{ height: 64, collapsed: !showTabs }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Logo />
            {DEV_AUTH && (
              <Badge color="yellow" variant="light" visibleFrom="xs">
                Dev auth
              </Badge>
            )}
          </Group>
          <Group gap="xs" wrap="nowrap">
            <AppearanceToggle />
            <Box hiddenFrom="sm">
              <AccountMenu />
            </Box>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Sidebar onNavigate={() => {}} />
      </AppShell.Navbar>
      {showTabs && (
        <AppShell.Footer className="mobile-tabs">
          <MobileNav />
        </AppShell.Footer>
      )}
      <AppShell.Main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            {DevLogin && <Route path="/dev-login" element={<DevLogin />} />}
            <Route element={<RequireAuth />}>
              <Route path="/setup" element={<UserSetup />} />
              <Route element={<RequireAccount />}>
                <Route path="/home/:sqid" element={<Home />} />
                <Route path="/transactions/:sqid" element={<Transactions />} />
                <Route path="/transactions/:sqid/:transaction_uuid" element={<TransactionDetail />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/savings" element={<Savings />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </AppShell.Main>
    </AppShell>
  );
};

export default AppRoutes;
