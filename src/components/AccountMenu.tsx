import { ActionIcon, Avatar, Button, Menu, Text } from "@mantine/core";
import { IconLogin, IconLogout, IconSettings } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useCurrentUser } from "../context/UserContext";

// Header account menu on phones, where there's no sidebar: Settings and Log out.
const AccountMenu = () => {
  const { isAuthenticated, loginWithRedirect, logout, user: authUser } = useAuth0();
  const { user, status } = useCurrentUser();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <Button size="compact-md" leftSection={<IconLogin size={16} />} onClick={() => loginWithRedirect({ appState: { returnTo: "/setup" } })}>
        Log in
      </Button>
    );
  }

  const name = user?.username || authUser?.name;
  return (
    <Menu position="bottom-end" width={220} withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" radius="xl" size={40} aria-label="Account menu">
          <Avatar color="initials" name={name} radius="xl" size={34} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={600} c="var(--mantine-color-text)" truncate>
            {name}
          </Text>
          <Text size="xs" truncate>
            {user?.email || authUser?.email}
          </Text>
        </Menu.Label>
        {status === "ready" && (
          <Menu.Item leftSection={<IconSettings size={16} />} onClick={() => navigate("/settings")}>
            Settings
          </Menu.Item>
        )}
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} />}
          onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
        >
          Log out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default AccountMenu;
