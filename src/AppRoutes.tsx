import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { AppShell, Burger, Center, Group, Loader, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Sidebar from "./components/Sidebar";
import { RequireAccount, RequireAuth } from "./components/RouteGuards";

const Landing = lazy(() => import("./pages/Landing"));
const Home = lazy(() => import("./pages/Home"));
const Transactions = lazy(() => import("./pages/Transactions"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail"));
const UserSetup = lazy(() => import("./pages/UserSetup"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <Center h="60vh">
    <Loader />
  </Center>
);

const AppRoutes = () => {
  const [navOpened, { toggle, close }] = useDisclosure(false);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !navOpened } }}
      padding={0}
    >
      <AppShell.Header>
        <Group h="100%" px="md" gap="sm">
          <Burger opened={navOpened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Text fw={700}>Extract</Text>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <Sidebar onNavigate={close} />
      </AppShell.Navbar>
      <AppShell.Main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<RequireAuth />}>
              <Route path="/setup" element={<UserSetup />} />
              <Route element={<RequireAccount />}>
                <Route path="/home/:sqid" element={<Home />} />
                <Route path="/transactions/:sqid" element={<Transactions />} />
                <Route path="/transactions/:sqid/:transaction_uuid" element={<TransactionDetail />} />
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
