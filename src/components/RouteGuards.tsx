import { Navigate, Outlet, useLocation, useParams } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { Button, Center, Loader, Stack, Text, Title } from "@mantine/core";
import { useCurrentUser } from "../context/UserContext";

const FullLoader = () => (
  <Center h="60vh">
    <Loader />
  </Center>
);

// Only renders child routes for signed-in users; offers a login button otherwise.
export const RequireAuth = () => {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const location = useLocation();

  if (isLoading) return <FullLoader />;

  if (!isAuthenticated) {
    return (
      <Center h="60vh" px="md">
        <Stack align="center" gap="sm">
          <Title order={3}>Please log in</Title>
          <Text c="dimmed">You need to be signed in to see this page.</Text>
          <Button
            onClick={() =>
              loginWithRedirect({
                appState: { returnTo: location.pathname + location.search },
              })
            }
          >
            Log in
          </Button>
        </Stack>
      </Center>
    );
  }

  return <Outlet />;
};

// Only renders child routes once the signed-in user has an account, and keeps the
// sqid in the URL pointing at their own account.
// Shown when the login can't be renewed: clear the stored session and log in again.
export const SessionExpired = () => {
  const { logout, loginWithRedirect } = useAuth0();
  const location = useLocation();
  const loginAgain = async () => {
    // forget the stored tokens locally without leaving the app, then start a fresh login
    await logout({ openUrl: false });
    await loginWithRedirect({ appState: { returnTo: location.pathname + location.search } });
  };
  return (
    <Center h="60vh" px="md">
      <Stack align="center" gap="sm" maw={420}>
        <Title order={3} ta="center">
          Please log in again
        </Title>
        <Text c="dimmed" ta="center">
          Your login has expired or couldn&apos;t be renewed.
        </Text>
        <Button onClick={loginAgain}>Log in again</Button>
      </Stack>
    </Center>
  );
};

export const RequireAccount = () => {
  const { status, sqid, refreshUser } = useCurrentUser();
  const { sqid: urlSqid } = useParams();
  const location = useLocation();

  if (status === "loading" || status === "signedOut") return <FullLoader />;
  if (status === "needsSetup") return <Navigate to="/setup" replace />;
  if (status === "sessionExpired") return <SessionExpired />;

  if (status === "error" || !sqid) {
    return (
      <Center h="60vh" px="md">
        <Stack align="center" gap="sm">
          <Title order={3}>Unable to load your account</Title>
          <Text c="dimmed">Issues contacting the server. Please try again.</Text>
          <Button onClick={refreshUser}>Retry</Button>
        </Stack>
      </Center>
    );
  }

  if (urlSqid && urlSqid !== sqid) {
    const fixedPath = location.pathname.replace(`/${urlSqid}`, `/${sqid}`);
    return <Navigate to={fixedPath + location.search} replace />;
  }

  return <Outlet />;
};
