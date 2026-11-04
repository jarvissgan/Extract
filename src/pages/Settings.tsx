import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  ColorSwatch,
  Group,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
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
import { useAuth0 } from "@auth0/auth0-react";
import { IconDownload, IconPlus, IconTrash } from "@tabler/icons-react";
import dayjs from "dayjs";
import api from "../lib/api";
import { findCategory } from "../lib/transactions";
import { parseJson, type RecurringRule, type TransactionRow, type TransactionType, type UserPreferences } from "../lib/types";
import { downloadFile } from "../lib/csv";
import { useCurrentUser } from "../context/UserContext";
import {
  BUILTIN_CATEGORIES,
  CATEGORY_COLORS,
  CURRENCIES,
  describeError,
  fieldErrors,
  MAX_RULES,
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
        budgets: { ...preferences.budgets, monthly: budget === "" ? "" : Number(budget) },
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
  const [type, setType] = useState<TransactionType>("expense");
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
      transaction_type: merged.transaction_type,
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
    const parsed = recurringSchema.safeParse({ transaction_type: type, name, amount, category, day_of_month: day });
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
      description="Bills, subscriptions and salary added automatically every month on the chosen day (the last day of shorter months). Paused rules skip months while paused."
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
                    <Table.Td ta="right" c={r.transaction_type === "income" ? "teal" : undefined}>
                      {r.transaction_type === "income" ? "+" : ""}
                      {formatMoney(Number(r.amount))}
                    </Table.Td>
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
          <Select
            label="Type"
            data={[
              { value: "expense", label: "Expense" },
              { value: "income", label: "Income" },
            ]}
            value={type}
            onChange={(v) => {
              const next = (v as TransactionType) || "expense";
              setType(next);
              setCategory(next === "income" ? "income" : "other");
            }}
            allowDeselect={false}
            w={110}
          />
          <TextInput label="Name" placeholder={type === "income" ? "e.g. Salary" : "e.g. Rent"} value={name} onChange={(e) => setName(e.currentTarget.value)} error={errors.name} w={180} />
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

const BudgetsSection = () => {
  const { categories, categoryBudgets, preferences, currencySymbol } = useCurrentUser();
  const save = useSaveAccount();
  const spendingCategories = categories.filter((c) => c.value !== "income");
  const [values, setValues] = useState<Record<string, number | string>>(() =>
    Object.fromEntries(spendingCategories.map((c) => [c.value, categoryBudgets[c.value] ?? ""]))
  );
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const next = Object.fromEntries(
      Object.entries(values)
        .filter(([, v]) => v !== "" && Number(v) > 0)
        .map(([k, v]) => [k, Number(v)])
    );
    setSaving(true);
    const ok = await save({ preferences: { budgets: { ...preferences.budgets, categories: next } } });
    setSaving(false);
    if (ok) notifications.show({ message: "Category budgets saved.", color: "green" });
  };

  return (
    <Section title="Category budgets" description="Optional monthly limits per category, shown on the dashboard. Leave blank for no limit.">
      <form onSubmit={onSubmit}>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" mb="md">
          {spendingCategories.map((c) => (
            <NumberInput
              key={c.value}
              label={c.label}
              placeholder="No limit"
              prefix={currencySymbol}
              thousandSeparator=","
              decimalScale={2}
              allowNegative={false}
              value={values[c.value] ?? ""}
              onChange={(v) => setValues((prev) => ({ ...prev, [c.value]: v }))}
            />
          ))}
        </SimpleGrid>
        <Button type="submit" loading={saving}>
          Save budgets
        </Button>
      </form>
    </Section>
  );
};

const RulesSection = () => {
  const { categories, rules } = useCurrentUser();
  const save = useSaveAccount();
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState(categories[0]?.value ?? "other");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const clean = pattern.trim().toLowerCase();
    if (clean.length < 2) return;
    // newest first, so it wins over older rules that also match
    if (await save({ preferences: { rules: [{ pattern: clean, category }, ...rules.filter((r) => r.pattern !== clean)] } })) {
      setPattern("");
    }
  };

  return (
    <Section
      title="Categorization rules"
      description="When a transaction's name contains the text, it gets that category automatically, when adding or importing. The first matching rule wins. You'll also be offered a rule when you change a transaction's category."
    >
      {rules.length > 0 && (
        <Table verticalSpacing="xs" mb="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name contains</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rules.map((r) => {
              const c = findCategory(categories, r.category);
              return (
                <Table.Tr key={r.pattern}>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {r.pattern}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={c.color}>
                      {c.label}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete rule ${r.pattern}`}
                      onClick={() => save({ preferences: { rules: rules.filter((x) => x.pattern !== r.pattern) } })}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
      <form onSubmit={add}>
        <Group align="flex-end" gap="sm">
          <TextInput label="Name contains" placeholder="e.g. grab" value={pattern} onChange={(e) => setPattern(e.currentTarget.value)} w={200} />
          <Select
            label="Category"
            data={categories.map(({ value, label }) => ({ value, label }))}
            value={category}
            onChange={(v) => setCategory(v || "other")}
            allowDeselect={false}
            w={160}
          />
          <Button type="submit" leftSection={<IconPlus size={16} />} disabled={pattern.trim().length < 2 || rules.length >= MAX_RULES}>
            Add rule
          </Button>
        </Group>
      </form>
    </Section>
  );
};

const DataSection = () => {
  const { user, sqid } = useCurrentUser();
  const { logout } = useAuth0();
  const [exporting, setExporting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const exportAll = async () => {
    setExporting(true);
    try {
      const [account, transactions, recurring] = await Promise.all([
        api.get("/user"),
        api.get<TransactionRow[]>(`/transaction/user/${sqid}`),
        api.get<RecurringRule[]>("/recurring"),
      ]);
      const data = {
        exported_at: new Date().toISOString(),
        account: account.data,
        transactions: transactions.data,
        recurring_transactions: recurring.data,
      };
      downloadFile(`extract-data-${dayjs().format("YYYY-MM-DD")}.json`, JSON.stringify(data, null, 2), "application/json");
    } catch {
      notifications.show({ message: "Couldn't export your data. Try again later.", color: "red" });
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = () =>
    modals.openConfirmModal({
      title: "Delete your account",
      centered: true,
      children: (
        <Text size="sm">
          This permanently deletes your account, all transactions and recurring rules. Download your data first if you
          want a copy.
        </Text>
      ),
      labels: { confirm: "Delete everything", cancel: "Cancel" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await api.delete(`/user/${sqid}`);
          notifications.show({ message: "Your account was deleted.", color: "green" });
          logout({ logoutParams: { returnTo: window.location.origin } });
        } catch {
          notifications.show({ message: "Couldn't delete your account. Try again later.", color: "red" });
        }
      },
    });

  return (
    <Section title="Your data" description="Download everything you've stored, or delete your account.">
      <Stack gap="md" maw={480}>
        <Group>
          <Button variant="default" leftSection={<IconDownload size={16} />} onClick={exportAll} loading={exporting}>
            Download all data (JSON)
          </Button>
        </Group>
        <Alert color="red" variant="light" title="Delete account">
          <Stack gap="xs">
            <Text size="sm">Type your email to confirm.</Text>
            <Group align="flex-end" gap="sm">
              <TextInput
                aria-label="Confirm email"
                placeholder={user?.email}
                value={confirmText}
                onChange={(e) => setConfirmText(e.currentTarget.value)}
                w={260}
              />
              <Button color="red" disabled={confirmText.trim().toLowerCase() !== user?.email?.toLowerCase()} onClick={deleteAccount}>
                Delete account
              </Button>
            </Group>
          </Stack>
        </Alert>
      </Stack>
    </Section>
  );
};

const Settings = () => (
  <Stack p={{ base: "md", md: "xl" }} gap="lg" maw={900}>
    <Title order={2}>Settings</Title>
    <AccountSection />
    <BudgetsSection />
    <CategoriesSection />
    <RulesSection />
    <RecurringSection />
    <DataSection />
  </Stack>
);

export default Settings;
