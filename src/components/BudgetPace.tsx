import { Anchor, Box, Card, Group, Stack, Text, Tooltip } from "@mantine/core";
import { Link } from "react-router";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useCurrentUser } from "../context/UserContext";

interface Props {
  month: Dayjs;
  spent: number;
  overCategories: string[];
}

type Status = "over" | "close" | "behind" | "onPace";
const STATUS_COLOR: Record<Status, string> = {
  over: "var(--mantine-color-red-filled)",
  close: "var(--mantine-color-yellow-filled)",
  behind: "var(--mantine-color-yellow-filled)",
  onPace: "var(--mantine-primary-color-filled)",
};

// The answer to "how much can I still spend?": what's left of the monthly budget, a bar
// of how much is used, and a marker for how much you'd expect to have spent by today if
// spending were spread evenly over the month. Spending past the marker means you're
// running ahead of your budget.
const BudgetPace = ({ month, spent, overCategories }: Props) => {
  const { monthlyBudget, formatMoney, hideAmounts } = useCurrentUser();
  const isCurrent = month.isSame(dayjs(), "month");
  const days = month.daysInMonth();
  const today = isCurrent ? dayjs().date() : days;
  const daysLeft = days - today;

  if (monthlyBudget === null || monthlyBudget <= 0) {
    return (
      <Card padding="xl">
        <Text c="dimmed" fw={500}>
          Spent in {month.format("MMMM")}
        </Text>
        <Text className="amount" fz={{ base: 44, sm: 56 }} fw={700} mt={4}>
          {formatMoney(spent)}
        </Text>
        <Text mt="sm" c="dimmed">
          Set a monthly budget to see how much is left and whether you&apos;re on pace.{" "}
          <Anchor component={Link} to="/settings" fw={600}>
            Set a budget
          </Anchor>
        </Text>
      </Card>
    );
  }

  const left = monthlyBudget - spent;
  const usedPercent = (spent / monthlyBudget) * 100;
  const expected = (monthlyBudget * today) / days;
  const expectedPercent = Math.min(100, (expected / monthlyBudget) * 100);
  const status: Status =
    usedPercent >= 100 ? "over" : usedPercent >= 80 ? "close" : spent > expected ? "behind" : "onPace";

  const headline =
    status === "over"
      ? "Over budget"
      : status === "close"
        ? "Close to your budget"
        : status === "behind"
          ? "Spending faster than planned"
          : "On pace";
  const detail =
    status === "over"
      ? `${formatMoney(spent - monthlyBudget)} more than your ${formatMoney(monthlyBudget)} budget${isCurrent ? " this month" : ""}.`
      : status === "close"
        ? `You've used ${Math.round(usedPercent)}% of your budget${isCurrent ? ` with ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}.`
        : status === "behind"
          ? `${formatMoney(spent - expected)} ahead of where an even spend would be by today.`
          : isCurrent
            ? `${formatMoney(expected - spent)} under where an even spend would be by today.`
            : "You stayed within your budget.";

  return (
    <Card padding="xl" aria-label="Budget">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="xs">
        <Stack gap={4}>
          <Text c="dimmed" fw={500}>
            {left >= 0 ? (isCurrent ? "Left to spend" : "Left over") : "Over by"}
          </Text>
          <Text
            className="amount"
            fz={{ base: 44, sm: 60 }}
            fw={700}
            c={left < 0 ? "red" : undefined}
            data-testid="left-to-spend"
          >
            {formatMoney(Math.abs(left))}
          </Text>
        </Stack>
        <Text c="dimmed" pb={6}>
          of your {formatMoney(monthlyBudget)} budget
        </Text>
      </Group>

      {/* the bar: used so far, with today's even-spend marker */}
      <Box pos="relative" mt="lg" mb={isCurrent ? 26 : 4}>
        <Box
          h={14}
          style={{ borderRadius: 999, background: "var(--mantine-color-default-border)", overflow: "hidden" }}
          role="progressbar"
          aria-label="Budget used"
          aria-valuenow={Math.round(usedPercent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <Box
            h="100%"
            w={`${Math.min(100, usedPercent)}%`}
            style={{ background: STATUS_COLOR[status], borderRadius: 999, transition: "width 300ms ease" }}
          />
        </Box>
        {isCurrent && !hideAmounts && (
          <Tooltip label={`An even spend by today: ${formatMoney(expected)}`} withArrow>
            <Box
              pos="absolute"
              top={-4}
              left={`${expectedPercent}%`}
              style={{ transform: "translateX(-50%)", textAlign: "center" }}
            >
              <Box w={2} h={22} mx="auto" style={{ background: "var(--mantine-color-text)", borderRadius: 1 }} />
              <Text size="xs" c="dimmed" mt={2}>
                Today
              </Text>
            </Box>
          </Tooltip>
        )}
      </Box>

      <Text mt="xs">
        <Text span fw={700} c={status === "over" ? "red" : status === "onPace" ? "teal" : "yellow"}>
          {headline}.
        </Text>{" "}
        {detail}
        {overCategories.length > 0 && ` Over budget in ${overCategories.join(", ")}.`}
      </Text>
    </Card>
  );
};

export default BudgetPace;
