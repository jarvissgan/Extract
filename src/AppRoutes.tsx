import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell, Badge, Burger, Center, Group, Loader } from "@mantine/core";
import Logo from "./components/Logo";
import AppearanceToggle from "./components/AppearanceToggle";
import { useDisclosure } from "@mantine/hooks";
import Sidebar from "./components/Sidebar";
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
  const [navOpened, { toggle, close }] = useDisclosure(false);

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !navOpened } }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={navOpened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Logo />
            {DEV_AUTH && (
              <Badge color="yellow" variant="light" visibleFrom="xs">
                Dev auth
              </Badge>
            )}
          </Group>
          <AppearanceToggle />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Sidebar onNavigate={close} />
      </AppShell.Navbar>
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
