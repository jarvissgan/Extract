import { useAuth0 } from "@auth0/auth0-react";
import { Button, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconChartPie, IconReceipt, IconTargetArrow } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { useCurrentUser } from "../context/UserContext";

const FEATURES = [
  {
    icon: IconReceipt,
    title: "Log spending in seconds",
    text: "Add a transaction with a name, amount, category and note from anywhere in the app.",
  },
  {
    icon: IconTargetArrow,
    title: "Stay on budget",
    text: "Set a monthly budget and see how much is left at a glance.",
  },
  {
    icon: IconChartPie,
    title: "See where it goes",
    text: "Category breakdowns and daily charts for any month.",
  },
];

const Landing = () => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { sqid } = useCurrentUser();
  const navigate = useNavigate();

  return (
    <Container size="md" py={{ base: 40, md: 80 }}>
      <Stack gap="xl">
        <Stack gap="sm" maw={560}>
          <Title order={1} fz={{ base: 36, md: 48 }}>
            Effortless expense tracking
          </Title>
          <Text size="lg" c="dimmed">
            Extract keeps track of what you spend each month, so you always know where your money
            went and how much budget you have left.
          </Text>
          <Group mt="md">
            {isAuthenticated ? (
              <Button size="md" onClick={() => navigate(sqid ? `/home/${sqid}` : "/setup")}>
                Go to dashboard
              </Button>
            ) : (
              <Button size="md" onClick={() => loginWithRedirect({ appState: { returnTo: "/setup" } })}>
                Get started
              </Button>
            )}
          </Group>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xl" mt="xl">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Stack key={title} gap="xs">
              <ThemeIcon size={40} radius="md" variant="light">
                <Icon size={22} stroke={1.5} />
              </ThemeIcon>
              <Text fw={600}>{title}</Text>
              <Text size="sm" c="dimmed">
                {text}
              </Text>
            </Stack>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
};

export default Landing;
