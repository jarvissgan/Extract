import { Button, NavLink, Stack, useComputedColorScheme, useMantineColorScheme } from "@mantine/core";
import {
  IconHome,
  IconListDetails,
  IconLogin,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useCurrentUser } from "../context/UserContext";
import AddTransactionModal from "./AddTransactionModal";

const Sidebar = ({ onNavigate }: { onNavigate: () => void }) => {
  const { setColorScheme } = useMantineColorScheme();
  const colorScheme = useComputedColorScheme("dark");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, loginWithRedirect, logout } = useAuth0();
  const { status, sqid } = useCurrentUser();

  const go = (route: string) => {
    navigate(route);
    onNavigate();
  };

  const links = sqid
    ? [
        { label: "Home", icon: IconHome, to: `/home/${sqid}` },
        { label: "Transactions", icon: IconListDetails, to: `/transactions/${sqid}` },
        { label: "Settings", icon: IconSettings, to: "/settings" },
      ]
    : [];

  return (
    <Stack justify="space-between" h="100%">
      <Stack gap="xs">
        {status === "ready" &&
          links.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              label={label}
              leftSection={<Icon size={18} stroke={1.5} />}
              active={pathname.startsWith(to)}
              onClick={() => go(to)}
            />
          ))}
        {status === "ready" && <AddTransactionModal />}
      </Stack>

      <Stack gap="xs">
        <Button
          variant="subtle"
          leftSection={colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
          onClick={() => setColorScheme(colorScheme === "dark" ? "light" : "dark")}
        >
          {colorScheme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        {isAuthenticated ? (
          <Button
            variant="default"
            leftSection={<IconLogout size={18} />}
            onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
          >
            Log out
          </Button>
        ) : (
          <Button
            leftSection={<IconLogin size={18} />}
            onClick={() => loginWithRedirect({ appState: { returnTo: "/setup" } })}
          >
            Log in
          </Button>
        )}
      </Stack>
    </Stack>
  );
};

export default Sidebar;
