import { ActionIcon, Group, Text, UnstyledButton } from "@mantine/core";
import { IconChartBar, IconHome, IconListDetails, IconPigMoney, IconPlus } from "@tabler/icons-react";
import { Link, useLocation } from "react-router";
import { useCurrentUser } from "../context/UserContext";
import { useTransactionEntry } from "../context/TransactionEntry";

// Bottom tab bar for phones. Tabs are links (so they work with long-press, back, etc.),
// with a raised + in the middle for the most common action.
const MobileNav = () => {
  const { sqid } = useCurrentUser();
  const { openAdd } = useTransactionEntry();
  const { pathname } = useLocation();

  const tabs = [
    { label: "Home", icon: IconHome, to: `/home/${sqid}` },
    { label: "Transactions", icon: IconListDetails, to: `/transactions/${sqid}` },
    null, // the + button
    { label: "Reports", icon: IconChartBar, to: "/reports" },
    { label: "Savings", icon: IconPigMoney, to: "/savings" },
  ];

  return (
    <Group component="nav" aria-label="Main" h="100%" gap={0} wrap="nowrap" justify="space-around" px={4}>
      {tabs.map((tab) => {
        if (!tab) {
          return (
            <ActionIcon
              key="add"
              size={52}
              radius="xl"
              variant="filled"
              aria-label="Add transaction"
              onClick={() => openAdd()}
              style={{ boxShadow: "var(--mantine-shadow-md)", marginTop: -18 }}
            >
              <IconPlus size={26} />
            </ActionIcon>
          );
        }
        const active = pathname.startsWith(tab.to);
        const Icon = tab.icon;
        return (
          <UnstyledButton
            key={tab.label}
            component={Link}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            style={{ flex: 1, minHeight: 48, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}
            c={active ? "var(--mantine-primary-color-filled)" : "dimmed"}
          >
            <Icon size={22} stroke={active ? 2.2 : 1.7} />
            <Text size="10px" fw={active ? 700 : 500} c="inherit" lh={1}>
              {tab.label}
            </Text>
          </UnstyledButton>
        );
      })}
    </Group>
  );
};

export default MobileNav;
