import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Center,
  ColorSwatch,
  Drawer,
  Group,
  Loader,
  Menu,
  Modal,
  NumberInput,
  RingProgress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import {
  IconCheck,
  IconDots,
  IconHistory,
  IconPencil,
  IconPigMoney,
  IconPlus,
  IconTarget,
  IconTrash,
  IconTrophy,
} from "@tabler/icons-react";
import dayjs from "dayjs";
import api from "../lib/api";
import { celebrate } from "../lib/celebrate";
import { formatDate } from "../lib/transactions";
import type { SavingsEntry, SavingsGoal } from "../lib/types";
import StatCard from "../components/StatCard";
import { useCurrentUser } from "../context/UserContext";
import { brandGradient, confettiColors, useAppearance } from "../theme/Appearance";
import { fieldErrors, GOAL_COLORS, savingsEntrySchema, savingsGoalSchema } from "../../shared/schemas.js";

const EMOJIS = ["🎯", "🗾", "✈️", "🏖️", "🏠", "🚗", "💻", "📱", "🎓", "💍", "🛟", "🎁", "🐶", "🎮", "💰"];

const percentOf = (g: SavingsGoal) => Math.min(100, (Number(g.saved) / Number(g.target_amount)) * 100);

// "S$120/month to reach it by 1 Jun 2027"
const pace = (g: SavingsGoal, formatMoney: (n: number) => string) => {
  if (!g.target_date) return null;
  const left = Number(g.target_amount) - Number(g.saved);
  const months = Math.max(1, Math.ceil(dayjs(g.target_date).diff(dayjs(), "month", true)));
  if (dayjs(g.target_date).isBefore(dayjs(), "day")) return `Deadline passed on ${formatDate(g.target_date)}`;
  return `${formatMoney(left / months)}/month to reach it by ${formatDate(g.target_date)}`;
};

// ---------- create / edit a goal ----------
const GoalModal = ({
  opened,
  onClose,
  goal,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  goal: SavingsGoal | null;
  onSaved: () => void;
}) => {
  const theme = useMantineTheme();
  const { currencySymbol } = useCurrentUser();
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | string>("");
  const [date, setDate] = useState<string | null>(null);
  const [emoji, setEmoji] = useState("🎯");
  const [color, setColor] = useState("pink");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setName(goal?.name ?? "");
    setTarget(goal ? Number(goal.target_amount) : "");
    setDate(goal?.target_date ?? null);
    setEmoji(goal?.emoji ?? "🎯");
    setColor(goal?.color ?? "pink");
    setErrors({});
  }, [opened, goal]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = savingsGoalSchema.safeParse({ name, target_amount: target, target_date: date, emoji, color });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      if (goal) await api.put(`/savings/${goal.goal_uuid}`, parsed.data);
      else await api.post("/savings", parsed.data);
      onSaved();
      onClose();
    } catch {
      notifications.show({ message: "Couldn't save the goal. Try again later.", color: "red" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={goal ? "Edit goal" : "New savings goal"} centered>
      <form onSubmit={submit} noValidate>
        <Stack>
          <TextInput label="What are you saving for?" placeholder="e.g. Japan trip" value={name} onChange={(e) => setName(e.currentTarget.value)} error={errors.name} data-autofocus />
          <Group grow align="flex-start">
            <NumberInput
              label="Target"
              prefix={currencySymbol}
              thousandSeparator=","
              decimalScale={2}
              allowNegative={false}
              value={target}
              onChange={setTarget}
              error={errors.target_amount}
            />
            <DatePickerInput
              label="By (optional)"
              placeholder="No deadline"
              value={date}
              onChange={setDate}
              minDate={dayjs().format("YYYY-MM-DD")}
              valueFormat="D MMM YYYY"
              clearable
            />
          </Group>
          <div>
            <Text size="sm" fw={500} mb={6}>
              Icon
            </Text>
            <Group gap={6}>
              {EMOJIS.map((e) => (
                <ActionIcon
                  key={e}
                  variant={emoji === e ? "light" : "subtle"}
                  color={color}
                  size="lg"
                  onClick={() => setEmoji(e)}
                  aria-label={`Icon ${e}`}
                  aria-pressed={emoji === e}
                >
                  <span style={{ fontSize: 18 }}>{e}</span>
                </ActionIcon>
              ))}
            </Group>
          </div>
          <div>
            <Text size="sm" fw={500} mb={6}>
              Color
            </Text>
            <Group gap={8}>
              {GOAL_COLORS.map((c) => (
                <ColorSwatch
                  key={c}
                  component="button"
                  type="button"
                  color={theme.colors[c][5]}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  style={{ cursor: "pointer", color: "#fff" }}
                >
                  {color === c && <IconCheck size={14} />}
                </ColorSwatch>
              ))}
            </Group>
          </div>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {goal ? "Save" : "Create goal"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

// ---------- add / take out money ----------
const EntryModal = ({
  goal,
  kind,
  onClose,
  onDone,
}: {
  goal: SavingsGoal | null;
  kind: "deposit" | "withdraw";
  onClose: () => void;
  onDone: (updated: SavingsGoal, reached: boolean) => void;
}) => {
  const { currencySymbol, formatMoney } = useCurrentUser();
  const [mode, setMode] = useState(kind);
  const [amount, setAmount] = useState<number | string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMode(kind);
    setAmount("");
    setNote("");
    setError(undefined);
  }, [goal, kind]);

  if (!goal) return null;
  const left = Math.max(0, Number(goal.target_amount) - Number(goal.saved));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = savingsEntrySchema.safeParse({ kind: mode, amount, note });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).amount);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ goal: SavingsGoal; reached: boolean }>(`/savings/${goal.goal_uuid}/entries`, parsed.data);
      onDone(res.data.goal, res.data.reached);
      onClose();
    } catch (err) {
      const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      setError(message || "Couldn't save. Try again later.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal opened={!!goal} onClose={onClose} title={`${goal.emoji ?? ""} ${goal.name}`.trim()} centered size="sm">
      <form onSubmit={submit} noValidate>
        <Stack>
          <SegmentedControl
            value={mode}
            onChange={(v) => setMode(v as "deposit" | "withdraw")}
            data={[
              { value: "deposit", label: "Add money" },
              { value: "withdraw", label: "Take out" },
            ]}
            fullWidth
          />
          <NumberInput
            label="Amount"
            prefix={currencySymbol}
            thousandSeparator=","
            decimalScale={2}
            allowNegative={false}
            value={amount}
            onChange={setAmount}
            error={error}
            description={
              mode === "deposit"
                ? left > 0
                  ? `${formatMoney(left)} to go`
                  : "Goal already reached"
                : `${formatMoney(Number(goal.saved))} saved so far`
            }
            data-autofocus
          />
          {mode === "deposit" && left > 0 && (
            <Button variant="light" size="xs" onClick={() => setAmount(left)} w="fit-content">
              Fill the rest ({formatMoney(left)})
            </Button>
          )}
          <TextInput label="Note" placeholder="Optional" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving} color={mode === "withdraw" ? "orange" : undefined}>
              {mode === "deposit" ? "Add" : "Take out"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
};

// ---------- history ----------
const HistoryDrawer = ({ goal, onClose, onChanged }: { goal: SavingsGoal | null; onClose: () => void; onChanged: () => void }) => {
  const { formatMoney } = useCurrentUser();
  const [entries, setEntries] = useState<SavingsEntry[] | null>(null);

  const load = useCallback(async () => {
    if (!goal) return;
    const res = await api.get<SavingsEntry[]>(`/savings/${goal.goal_uuid}/entries`);
    setEntries(res.data);
  }, [goal]);

  useEffect(() => {
    setEntries(null);
    load().catch(() => setEntries([]));
  }, [load]);

  const remove = async (entry: SavingsEntry) => {
    await api.delete(`/savings/${goal!.goal_uuid}/entries/${entry.entry_uuid}`);
    await load();
    onChanged();
  };

  return (
    <Drawer opened={!!goal} onClose={onClose} position="right" title={goal ? `${goal.emoji ?? ""} ${goal.name} history`.trim() : ""}>
      {!entries ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : entries.length === 0 ? (
        <Text c="dimmed">Nothing saved yet.</Text>
      ) : (
        <Stack gap="xs">
          {entries.map((e) => (
            <Card key={e.entry_uuid} padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text fw={600} c={Number(e.amount) < 0 ? "orange" : "teal"} className="tabular">
                    {Number(e.amount) < 0 ? "−" : "+"}
                    {formatMoney(Math.abs(Number(e.amount)))}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDate(e.created_timestamp)}
                    {e.note ? ` · ${e.note}` : ""}
                  </Text>
                </div>
                <ActionIcon variant="subtle" color="red" onClick={() => remove(e)} aria-label="Delete entry">
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Drawer>
  );
};

// ---------- one goal ----------
const GoalCard = ({
  goal,
  onAdd,
  onWithdraw,
  onEdit,
  onHistory,
  onDelete,
}: {
  goal: SavingsGoal;
  onAdd: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) => {
  const { formatMoney } = useCurrentUser();
  const percent = percentOf(goal);
  const reached = !!goal.reached_timestamp;
  const paceText = !reached ? pace(goal, formatMoney) : null;

  return (
    <Card padding="lg" shadow="xs" className="lift" aria-label={`Savings goal ${goal.name}`}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <ThemeIcon variant="light" color={goal.color} size={44} radius="md">
            <span style={{ fontSize: 22 }}>{goal.emoji ?? "🎯"}</span>
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text fw={700} truncate>
              {goal.name}
            </Text>
            {reached ? (
              <Badge color={goal.color} variant="light" leftSection={<IconTrophy size={12} />}>
                Reached {formatDate(goal.reached_timestamp)}
              </Badge>
            ) : (
              <Text size="xs" c="dimmed">
                {goal.target_date ? `By ${formatDate(goal.target_date)}` : "No deadline"}
              </Text>
            )}
          </div>
        </Group>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label={`More options for ${goal.name}`}>
              <IconDots size={18} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconHistory size={14} />} onClick={onHistory}>
              History
            </Menu.Item>
            <Menu.Item leftSection={<IconPencil size={14} />} onClick={onEdit}>
              Edit goal
            </Menu.Item>
            <Menu.Item leftSection={<IconTrash size={14} />} color="red" onClick={onDelete}>
              Delete goal
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      <Center my="md">
        <RingProgress
          size={150}
          thickness={14}
          roundCaps
          sections={[{ value: percent, color: goal.color }]}
          label={
            <Stack gap={0} align="center">
              {reached ? (
                <Text fz={30} lh={1}>
                  🎉
                </Text>
              ) : (
                <Text fw={800} fz={26} lh={1.1} className="tabular">
                  {Math.floor(percent)}%
                </Text>
              )}
              <Text size="xs" c="dimmed">
                {reached ? "done!" : "saved"}
              </Text>
            </Stack>
          }
        />
      </Center>

      <Text ta="center" fw={700} fz="lg" className="tabular">
        {formatMoney(Number(goal.saved))}
        <Text span c="dimmed" fw={500} fz="sm">
          {" "}
          of {formatMoney(Number(goal.target_amount))}
        </Text>
      </Text>
      <Text ta="center" size="xs" c="dimmed" mt={4} mih={18}>
        {paceText ??
          (!reached ? `${formatMoney(Number(goal.target_amount) - Number(goal.saved))} to go` : "Keep it up!")}
      </Text>

      <Group grow mt="md">
        <Button color={goal.color} leftSection={<IconPlus size={16} />} onClick={onAdd}>
          Add money
        </Button>
        <Button variant="default" onClick={onWithdraw} disabled={Number(goal.saved) <= 0}>
          Take out
        </Button>
      </Group>
    </Card>
  );
};

// ---------- page ----------
const Savings = () => {
  const { formatMoney } = useCurrentUser();
  const { appearance } = useAppearance();
  const [goals, setGoals] = useState<SavingsGoal[] | null>(null);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [entryGoal, setEntryGoal] = useState<SavingsGoal | null>(null);
  const [entryKind, setEntryKind] = useState<"deposit" | "withdraw">("deposit");
  const [historyGoal, setHistoryGoal] = useState<SavingsGoal | null>(null);
  const [celebrating, setCelebrating] = useState<SavingsGoal | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<SavingsGoal[]>("/savings");
      setGoals(res.data);
    } catch {
      setGoals([]);
      notifications.show({ message: "Couldn't load your savings goals.", color: "red" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onEntry = (updated: SavingsGoal, reached: boolean) => {
    load();
    if (reached) {
      celebrate(confettiColors(appearance));
      setCelebrating(updated);
    }
  };

  const confirmDelete = (goal: SavingsGoal) =>
    modals.openConfirmModal({
      title: "Delete goal",
      centered: true,
      children: <Text size="sm">Delete “{goal.name}” and its history? This can&apos;t be undone.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await api.delete(`/savings/${goal.goal_uuid}`);
        load();
      },
    });

  const totalSaved = (goals ?? []).reduce((s, g) => s + Number(g.saved), 0);
  const totalTarget = (goals ?? []).reduce((s, g) => s + Number(g.target_amount), 0);
  const reachedCount = (goals ?? []).filter((g) => g.reached_timestamp).length;

  const newGoal = () => {
    setEditing(null);
    setGoalModalOpen(true);
  };

  return (
    <Stack p={{ base: "md", md: "xl" }} gap="lg">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Savings</Title>
          <Text c="dimmed" size="sm">
            Set goals, put money aside, and watch them fill up.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} variant="gradient" gradient={brandGradient(appearance)} onClick={newGoal}>
          New goal
        </Button>
      </Group>

      {!goals ? (
        <Center py="xl">
          <Loader />
        </Center>
      ) : goals.length === 0 ? (
        <Card padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={64} radius="xl" variant="light">
              <IconPigMoney size={34} />
            </ThemeIcon>
            <Title order={3}>Start your first savings goal</Title>
            <Text c="dimmed" ta="center" maw={420}>
              A trip, a new laptop, an emergency fund… pick a target, add money whenever you save, and celebrate when
              you get there.
            </Text>
            <Button mt="sm" leftSection={<IconPlus size={16} />} onClick={newGoal}>
              Create a goal
            </Button>
          </Stack>
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <StatCard label="Total saved" icon={<IconPigMoney size={20} />}>
              <Title order={2} className="tabular">
                {formatMoney(totalSaved)}
              </Title>
              <Text size="sm" c="dimmed">
                across {goals.length} goal{goals.length === 1 ? "" : "s"}
              </Text>
            </StatCard>
            <StatCard label="Overall progress" icon={<IconTarget size={20} />}>
              <Title order={2} className="tabular">
                {totalTarget > 0 ? Math.floor(Math.min(100, (totalSaved / totalTarget) * 100)) : 0}%
              </Title>
              <Text size="sm" c="dimmed">
                of {formatMoney(totalTarget)} in targets
              </Text>
            </StatCard>
            <StatCard label="Goals reached" icon={<IconTrophy size={20} />}>
              <Title order={2}>
                {reachedCount} / {goals.length}
              </Title>
              <Text size="sm" c="dimmed">
                {reachedCount ? "Nice work 🎉" : "Your first one is coming"}
              </Text>
            </StatCard>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {goals.map((g) => (
              <GoalCard
                key={g.goal_uuid}
                goal={g}
                onAdd={() => {
                  setEntryKind("deposit");
                  setEntryGoal(g);
                }}
                onWithdraw={() => {
                  setEntryKind("withdraw");
                  setEntryGoal(g);
                }}
                onEdit={() => {
                  setEditing(g);
                  setGoalModalOpen(true);
                }}
                onHistory={() => setHistoryGoal(g)}
                onDelete={() => confirmDelete(g)}
              />
            ))}
          </SimpleGrid>
        </>
      )}

      <GoalModal opened={goalModalOpen} onClose={() => setGoalModalOpen(false)} goal={editing} onSaved={load} />
      <EntryModal goal={entryGoal} kind={entryKind} onClose={() => setEntryGoal(null)} onDone={onEntry} />
      <HistoryDrawer goal={historyGoal} onClose={() => setHistoryGoal(null)} onChanged={load} />

      <Modal opened={!!celebrating} onClose={() => setCelebrating(null)} centered withCloseButton={false} size="sm">
        <Stack align="center" gap="xs" py="md">
          <Text fz={56} lh={1}>
            🎉
          </Text>
          <Title order={2} ta="center">
            Goal reached!
          </Title>
          <Text ta="center" c="dimmed">
            You saved {celebrating ? formatMoney(Number(celebrating.saved)) : ""} for {celebrating?.emoji}{" "}
            {celebrating?.name}. Amazing.
          </Text>
          <Button mt="md" onClick={() => setCelebrating(null)} variant="gradient" gradient={brandGradient(appearance)}>
            Yay!
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
};

export default Savings;
