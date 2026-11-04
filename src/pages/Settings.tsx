import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  ColorSwatch,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
  useMantineTheme,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import api from "../lib/api";
import { findCategory } from "../lib/transactions";
import { parseJson, type RecurringRule, type UserPreferences } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import {
  BUILTIN_CATEGORIES,
  CATEGORY_COLORS,
  CURRENCIES,
  describeError,
  fieldErrors,
  recurringSchema,
  userSchema,
} from "../../shared/schemas.js";

const Section = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <Paper withBorder radius="md" p="lg">
    <Title order={4}>{title}</Title>
    <Text size="sm" c="dimmed" mb="md">
      {description}
    </Text>
    {children}
  </Paper>
);

const slug = (label: string) =>
  label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

// Saves the whole account with some preference changes applied.
const useSaveAccount = () => {
  const { user, sqid, preferences, refreshUser } = useCurrentUser();
  return useCallback(
    async (changes: { username?: string; preferences?: Partial<UserPreferences> }) => {
      const body = {
        username: changes.username ?? user?.username,
        account_status: parseJson(user?.account_status, { status: "active" }),
        preference_json: { ...preferences, ...changes.preferences },
      };
      const parsed = userSchema.safeParse(body);
      if (!parsed.success) {
        notifications.show({ title: "Couldn't save", message: describeError(parsed.error), color: "red" });
        return false;
      }
      try {
        await api.put(`/user/${sqid}`, parsed.data);
        await refreshUser();
        return true;
      } catch {
        notifications.show({ title: "Couldn't save", message: "Issues contacting server. Try again later.", color: "red" });
        return false;
      }
    },
    [user, sqid, preferences, refreshUser]
  );
};

const AccountSection = () => {
  const { user, preferences, monthlyBudget, currency, currencySymbol } = useCurrentUser();
  const save = useSaveAccount();
  const [username, setUsername] = useState(user?.username ?? "");
  const [budget, setBudget] = useState<number | string>(monthlyBudget ?? "");
  const [newCurrency, setNewCurrency] = useState(currency);
  const [emailNotifications, setEmailNotifications] = useState(!!preferences.notifications?.email);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = await save({
      username,
      preferences: {
        budgets: { monthly: budget === "" ? "" : Number(budget) },
        currency: newCurrency,
        notifications: { email: emailNotifications },
      },
    });
    setSaving(false);
    if (ok) notifications.show({ message: "Settings saved.", color: "green" });
  };

  return (
    <Section title="Account" description="Your name, monthly budget and currency.">
      <form onSubmit={onSubmit}>
        <Stack maw={420}>
          <TextInput label="Username" value={username} onChange={(e) => setUsername(e.currentTarget.value)} required />
          <TextInput label="Email" value={user?.email ?? ""} readOnly description="Comes from your login and can't be changed here." />
          <Group grow align="flex-start">
            <NumberInput
              label="Monthly budget"
              prefix={currencySymbol}
              thousandSeparator=","
              decimalScale={2}
              allowNegative={false}
              value={budget}
              onChange={setBudget}
              placeholder="No budget"
            />
            <Select
              label="Currency"
              data={CURRENCIES}
              value={newCurrency}
              onChange={(v) => setNewCurrency(v || "USD")}
              allowDeselect={false}
              searchable
            />
          </Group>
          <Checkbox
            label="Email me notifications"
            checked={emailNotifications}
            onChange={(e) => setEmailNotifications(e.currentTarget.checked)}
          />
          <Group>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Section>
  );
};

const CategoriesSection = () => {
  const theme = useMantineTheme();
  const { preferences } = useCurrentUser();
  const save = useSaveAccount();
  const custom = preferences.categories ?? [];
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[custom.length % CATEGORY_COLORS.length]);

  const swatch = (c: string) => {
    const [name, shade] = c.split(".");
    return theme.colors[name]?.[Number(shade)] ?? theme.colors.gray[6];
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const value = slug(label);
    if (!value) return;
    if (await save({ preferences: { categories: [...custom, { value, label: label.trim(), color }] } })) {
      setLabel("");
      setColor(CATEGORY_COLORS[(custom.length + 1) % CATEGORY_COLORS.length]);
    }
  };

  const remove = (value: string) =>
    modals.openConfirmModal({
      title: "Remove category",
      centered: true,
      children: (
        <Text size="sm">
          Existing transactions in this category will show as &quot;Other&quot; until you change them.
        </Text>
      ),
      labels: { confirm: "Remove", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: () => save({ preferences: { categories: custom.filter((c) => c.value !== value) } }),
    });

  return (
    <Section title="Categories" description="Built-in categories are always available. Add your own below.">
      <Group gap="xs" mb="md">
        {BUILTIN_CATEGORIES.map((c) => (
          <Badge key={c.value} variant="light" color={c.color}>
            {c.label}
          </Badge>
        ))}
        {custom.map((c) => (
          <Badge
            key={c.value}
            variant="light"
            color={c.color}
            rightSection={
              <ActionIcon size="xs" variant="transparent" color={c.color} aria-label={`Remove ${c.label}`} onClick={() => remove(c.value)}>
                <IconTrash size={12} />
              </ActionIcon>
            }
          >
            {c.label}
          </Badge>
        ))}
      </Group>
      <form onSubmit={add}>
        <Group align="flex-end" gap="sm">
          <TextInput label="New category" placeholder="e.g. Travel" value={label} onChange={(e) => setLabel(e.currentTarget.value)} w={200} />
          <Select
            label="Color"
            data={CATEGORY_COLORS.map((c) => ({ value: c, label: c.split(".")[0] }))}
            value={color}
            onChange={(v) => setColor(v || CATEGORY_COLORS[0])}
            leftSection={<ColorSwatch color={swatch(color)} size={14} />}
            allowDeselect={false}
            w={140}
          />
          <Button type="submit" leftSection={<IconPlus size={16} />} disabled={!slug(label)}>
            Add
          </Button>
        </Group>
      </form>
    </Section>
  );
};

const RecurringSection = () => {
  const { categories, currencySymbol, formatMoney, notifyTransactionsChanged } = useCurrentUser();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState<number | string>("");
  const [category, setCategory] = useState("other");
  const [day, setDay] = useState<number | string>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await api.get<RecurringRule[]>("/recurring");
    setRules(res.data);
  }, []);

  useEffect(() => {
    load().catch(() =>
      notifications.show({ message: "Couldn't load recurring transactions.", color: "red" })
    );
  }, [load]);

  const toBody = (r: RecurringRule, changes: Partial<RecurringRule> = {}) => {
    const merged = { ...r, ...changes };
    return {
      name: merged.name,
      amount: merged.amount,
      category: merged.category,
      note: merged.note ?? "",
      day_of_month: merged.day_of_month,
      active: !!merged.active,
    };
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = recurringSchema.safeParse({ name, amount, category, day_of_month: day });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    try {
      await api.post("/recurring", parsed.data);
      setName("");
      setAmount("");
      await load();
      notifyTransactionsChanged();
      notifications.show({ message: "Recurring transaction added.", color: "green" });
    } catch {
      notifications.show({ message: "Couldn't add the recurring transaction.", color: "red" });
    }
  };

  const toggle = async (rule: RecurringRule) => {
    await api.put(`/recurring/${rule.recurring_uuid}`, toBody(rule, { active: !rule.active }));
    await load();
    notifyTransactionsChanged();
  };

  const remove = (rule: RecurringRule) =>
    modals.openConfirmModal({
      title: "Delete recurring transaction",
      centered: true,
      children: <Text size="sm">Stop repeating “{rule.name}”? Transactions it already added are kept.</Text>,
      labels: { confirm: "Delete", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await api.delete(`/recurring/${rule.recurring_uuid}`);
        await load();
      },
    });

  return (
    <Section
      title="Recurring transactions"
      description="Added automatically every month on the chosen day (the last day of shorter months). Paused rules skip months while paused."
    >
      {rules.length > 0 && (
        <Table.ScrollContainer minWidth={520} mb="md">
          <Table verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
                <Table.Th>Day</Table.Th>
                <Table.Th>Active</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((r) => {
                const c = findCategory(categories, r.category);
                return (
                  <Table.Tr key={r.recurring_uuid}>
                    <Table.Td>{r.name}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={c.color}>
                        {c.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td ta="right">{formatMoney(Number(r.amount))}</Table.Td>
                    <Table.Td>{r.day_of_month}</Table.Td>
                    <Table.Td>
                      <Switch checked={!!r.active} onChange={() => toggle(r)} aria-label={`${r.name} active`} />
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color="red" onClick={() => remove(r)} aria-label={`Delete ${r.name}`}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <form onSubmit={add} noValidate>
        <Group align="flex-start" gap="sm">
          <TextInput label="Name" placeholder="e.g. Rent" value={name} onChange={(e) => setName(e.currentTarget.value)} error={errors.name} w={180} />
          <NumberInput
            label="Amount"
            prefix={currencySymbol}
            thousandSeparator=","
            decimalScale={2}
            allowNegative={false}
            value={amount}
            onChange={setAmount}
            error={errors.amount}
            w={130}
          />
          <Select
            label="Category"
            data={categories.map(({ value, label }) => ({ value, label }))}
            value={category}
            onChange={(v) => setCategory(v || "other")}
            allowDeselect={false}
            w={150}
          />
          <NumberInput label="Day of month" min={1} max={31} value={day} onChange={setDay} error={errors.day_of_month} w={110} />
          <Button type="submit" mt={25} leftSection={<IconPlus size={16} />}>
            Add
          </Button>
        </Group>
      </form>
    </Section>
  );
};

const Settings = () => (
  <Stack p={{ base: "md", md: "xl" }} gap="lg" maw={900}>
    <Title order={2}>Settings</Title>
    <AccountSection />
    <CategoriesSection />
    <RecurringSection />
  </Stack>
);

export default Settings;
