import { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Button, Center, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router";
import UserAccountForm from "../components/UserAccountForm";
import { useCurrentUser } from "../context/UserContext";
import { SessionExpired } from "../components/RouteGuards";

const UserSetup = () => {
  const { user } = useAuth0();
  const { status, sqid, refreshUser } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "ready" && sqid) navigate(`/home/${sqid}`, { replace: true });
  }, [status, sqid, navigate]);

  if (status === "sessionExpired") return <SessionExpired />;

  if (status === "error") {
    return (
      <Center h="60vh" px="md">
        <Stack align="center" gap="sm">
          <Title order={3}>Unable to check your account</Title>
          <Button onClick={refreshUser}>Retry</Button>
        </Stack>
      </Center>
    );
  }

  if (status !== "needsSetup") {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    );
  }

  return (
    <Center py="xl" px="md">
      <Paper withBorder radius="md" p="xl" w="100%" maw={480}>
        <Title order={3}>Finish setting up your account</Title>
        <Text c="dimmed" size="sm" mb="lg">
          Set a monthly budget to track your spending against.
        </Text>
        <UserAccountForm username={user?.name ?? ""} email={user?.email ?? ""} onCreated={refreshUser} />
      </Paper>
    </Center>
  );
};

export default UserSetup;
