import { useAuth0 } from "@auth0/auth0-react";
import { Badge, Button, Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconChartPie, IconPigMoney, IconReceipt, IconTargetArrow } from "@tabler/icons-react";
import { brandGradient, useAppearance } from "../theme/Appearance";
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
    text: "Category breakdowns, monthly trends and income vs spending.",
  },
  {
    icon: IconPigMoney,
    title: "Save towards goals",
    text: "Set savings goals, track progress, and celebrate when you get there.",
  },
];

const Landing = () => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const { sqid } = useCurrentUser();
  const navigate = useNavigate();
  const { appearance } = useAppearance();

  return (
    <Container size="lg" py={{ base: 40, md: 80 }}>
      <Stack gap="xl">
        <Stack gap="sm" maw={620}>
          <Badge variant="light" size="lg" w="fit-content">
            Personal finance, simplified
          </Badge>
          <Title order={1} fz={{ base: 40, md: 58 }} lh={1.05} lts={-1}>
            Effortless{" "}
            <Text span inherit className="brand-text">
              expense tracking
            </Text>
          </Title>
          <Text size="lg" c="dimmed">
            Extract keeps track of what you spend each month, so you always know where your money
            went and how much budget you have left.
          </Text>
          <Group mt="md">
            {isAuthenticated ? (
              <Button size="lg" variant="gradient" gradient={brandGradient(appearance)} onClick={() => navigate(sqid ? `/home/${sqid}` : "/setup")}>
                Go to dashboard
              </Button>
            ) : (
              <Button size="lg" variant="gradient" gradient={brandGradient(appearance)} onClick={() => loginWithRedirect({ appState: { returnTo: "/setup" } })}>
                Get started
              </Button>
            )}
          </Group>
        </Stack>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mt="xl">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title} padding="lg" shadow="xs" className="lift">
              <ThemeIcon size={44} radius="md" variant="light" mb="sm">
                <Icon size={24} stroke={1.6} />
              </ThemeIcon>
              <Text fw={700} mb={4}>
                {title}
              </Text>
              <Text size="sm" c="dimmed">
                {text}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
};

export default Landing;
