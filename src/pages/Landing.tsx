import { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { Box, Button, Card, Checkbox, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconChartPie, IconPigMoney, IconReceipt, IconTargetArrow } from "@tabler/icons-react";
import { ctaProps, useAppearance } from "../theme/Appearance";
import { PoohBear } from "../components/Pooh";
import { useNavigate } from "react-router";
import { useCurrentUser } from "../context/UserContext";
import { useLogin } from "../auth/useLogin";
import { getRemember } from "../auth/remember";

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
  const { isAuthenticated } = useAuth0();
  const login = useLogin();
  const [remember, setRememberChoice] = useState(getRemember);
  const { sqid } = useCurrentUser();
  const navigate = useNavigate();
  const { appearance } = useAppearance();

  return (
    <Container size="lg" py={{ base: 40, md: 80 }}>
      <Stack gap="xl">
        <Group justify="space-between" align="center" wrap="nowrap" gap="xl">
        <Stack gap="sm" maw={620}>
          <Title order={1} fz={{ base: 40, md: 60 }} lh={1.02} lts={-1.5}>
            Know what&apos;s left to spend, any day of the month.
          </Title>
          <Text size="lg" c="dimmed" maw={520}>
            Add what you spend in a few taps or import your bank statements. Extract shows how much of
            your budget is left and whether you&apos;re on pace.
          </Text>
          <Group mt="md">
            {isAuthenticated ? (
              <Button size="lg" {...ctaProps(appearance)} onClick={() => navigate(sqid ? `/home/${sqid}` : "/setup")}>
                Go to dashboard
              </Button>
            ) : (
              <Stack gap="sm">
                <Button size="lg" {...ctaProps(appearance)} onClick={() => login("/setup", remember)}>
                  Get started
                </Button>
                <Checkbox
                  label="Remember me on this device"
                  description="Untick on a shared computer: you'll be logged out when the browser closes."
                  checked={remember}
                  onChange={(e) => setRememberChoice(e.currentTarget.checked)}
                />
              </Stack>
            )}
          </Group>
        </Stack>
          {appearance === "a" && (
            <Box className="pooh-sway" visibleFrom="sm" style={{ flexShrink: 0 }}>
              <PoohBear size={220} />
            </Box>
          )}
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mt="xl">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <Card key={title} padding="lg">
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
