import { Avatar, Button, Group, Kbd, NavLink, Stack, Text } from "@mantine/core";
import {
  IconChartBar,
  IconHome,
  IconListDetails,
  IconLogin,
  IconLogout,
  IconPigMoney,
  IconPlus,
  IconSettings,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { useAuth0 } from "@auth0/auth0-react";
import { useCurrentUser } from "../context/UserContext";
import { useTransactionEntry } from "../context/TransactionEntry";
import { ctaProps, useAppearance } from "../theme/Appearance";
import { PoohBear } from "./Pooh";

const Sidebar = ({ onNavigate }: { onNavigate: () => void }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, loginWithRedirect, logout, user: authUser } = useAuth0();
  const { status, sqid, user } = useCurrentUser();
  const { openAdd } = useTransactionEntry();
  const { appearance } = useAppearance();

  const go = (route: string) => {
    navigate(route);
    onNavigate();
  };

  const links = sqid
    ? [
        { label: "Home", icon: IconHome, to: `/home/${sqid}` },
        { label: "Transactions", icon: IconListDetails, to: `/transactions/${sqid}` },
        { label: "Reports", icon: IconChartBar, to: "/reports" },
        { label: "Savings", icon: IconPigMoney, to: "/savings" },
        { label: "Settings", icon: IconSettings, to: "/settings" },
      ]
    : [];

  return (
    <Stack justify="space-between" h="100%">
      <Stack gap={4}>
        {status === "ready" && (
          <Button
            size="md"
            fullWidth
            leftSection={<IconPlus size={18} />}
            rightSection={
              <Kbd size="xs" visibleFrom="sm" style={{ opacity: 0.8 }}>
                N
              </Kbd>
            }
            justify="space-between"
            onClick={() => {
              openAdd();
              onNavigate();
            }}
            {...ctaProps(appearance)}
          >
            Add transaction
          </Button>
        )}
        {status === "ready" && (
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="lg" mb={4} px="sm">
            Menu
          </Text>
        )}
        {status === "ready" &&
          links.map(({ label, icon: Icon, to }) => (
            <NavLink
              key={label}
              label={label}
              fw={500}
              leftSection={<Icon size={19} stroke={1.6} />}
              active={pathname.startsWith(to)}
              onClick={() => go(to)}
            />
          ))}
      </Stack>

      <Stack gap="sm">
        {appearance === "a" && (
          <Group justify="center" className="pooh-sway" aria-hidden>
            <PoohBear size={96} />
          </Group>
        )}
        {isAuthenticated && (user || authUser) && (
          <Group gap="sm" wrap="nowrap" px={4}>
            <Avatar color="initials" name={user?.username || authUser?.name} radius="xl" size="md" />
            <div style={{ minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {user?.username || authUser?.name}
              </Text>
              <Text size="xs" c="dimmed" truncate>
                {user?.email || authUser?.email}
              </Text>
            </div>
          </Group>
        )}
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
