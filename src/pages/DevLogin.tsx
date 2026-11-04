import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { Alert, Button, Center, Divider, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconTool } from "@tabler/icons-react";
import { SEEDED_DEV_USERS, type DevUser } from "../auth/devAuth";

// Offline login screen used when VITE_AUTH_MODE=dev.
const DevLogin = () => {
  const auth = useAuth0() as ReturnType<typeof useAuth0> & { devSignIn?: (user: DevUser) => void };
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo") || "/setup";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const signIn = (user: DevUser) => {
    auth.devSignIn?.(user);
    navigate(returnTo, { replace: true });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    signIn({ email: trimmed, name: name.trim() || trimmed.split("@")[0] });
  };

  return (
    <Center py="xl" px="md">
      <Paper withBorder radius="md" p="xl" w="100%" maw={420}>
        <Stack>
          <Title order={3}>Dev login</Title>
          <Alert color="yellow" icon={<IconTool size={18} />}>
            Offline auth is on (VITE_AUTH_MODE=dev). Pick any email; no password needed.
          </Alert>

          <Text size="sm" fw={600}>
            Seeded users
          </Text>
          {SEEDED_DEV_USERS.map((user) => (
            <Button key={user.email} variant="light" onClick={() => signIn(user)}>
              {user.name} ({user.email})
            </Button>
          ))}

          <Divider label="or a new user" labelPosition="center" />

          <form onSubmit={onSubmit}>
            <Stack>
              <TextInput
                label="Email"
                type="email"
                required
                placeholder="new-user@extract.local"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
              />
              <TextInput
                label="Name"
                placeholder="Optional"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
              />
              <Button type="submit">Sign in</Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Center>
  );
};

export default DevLogin;
