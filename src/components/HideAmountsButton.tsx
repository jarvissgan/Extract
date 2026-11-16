import { ActionIcon, Tooltip } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useCurrentUser } from "../context/UserContext";

// Header button: conceals every amount (balances, totals, budgets, charts) for this visit,
// e.g. when someone can see your screen. The default is set in Settings → Privacy.
const HideAmountsButton = () => {
  const { status, hideAmounts, setHideAmounts } = useCurrentUser();
  if (status !== "ready") return null;
  const label = hideAmounts ? "Show amounts" : "Hide amounts";
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon
        variant="default"
        radius="xl"
        size="lg"
        aria-label={label}
        aria-pressed={hideAmounts}
        onClick={() => setHideAmounts(!hideAmounts)}
      >
        {hideAmounts ? <IconEyeOff size={18} stroke={1.8} /> : <IconEye size={18} stroke={1.8} />}
      </ActionIcon>
    </Tooltip>
  );
};

export default HideAmountsButton;
