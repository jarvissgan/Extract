import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { useNavigate } from "react-router";
import { useCurrentUser } from "../context/UserContext";

const NotFound = () => {
  const { sqid } = useCurrentUser();
  const navigate = useNavigate();

  return (
    <Center h="60vh" px="md">
      <Stack align="center" gap="sm">
        <Title order={2}>Page not found</Title>
        <Text c="dimmed">The link you followed doesn&apos;t exist.</Text>
        <Button onClick={() => navigate(sqid ? `/home/${sqid}` : "/", { replace: true })}>
          {sqid ? "Go to home" : "Go to the start page"}
        </Button>
      </Stack>
    </Center>
  );
};

export default NotFound;
