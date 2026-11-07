import { useMemo, useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  FileInput,
  Group,
  List,
  Loader,
  Modal,
  NativeSelect,
  PasswordInput,
  Stack,
  Text,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileTypePdf, IconLock, IconShieldCheck } from "@tabler/icons-react";
import dayjs from "dayjs";
import api from "../lib/api";
import { readStatementPdf, PdfPasswordError, type StatementRow } from "../lib/pdfStatement";
import type { TransactionRow } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { categoryFromRules, describeError, importSchema, MAX_IMPORT_ROWS } from "../../shared/schemas.js";

interface PreviewRow extends StatementRow {
  id: string;
  duplicate: boolean;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  // called with the dates (ISO) of the imported transactions
  onImported?: (dates: string[]) => void;
}

const KIND_BADGE: Partial<Record<StatementRow["kind"], { label: string; color: string }>> = {
  transfer: { label: "Transfer", color: "gray" },
  refund: { label: "Refund", color: "teal" },
  cash: { label: "Cash", color: "yellow" },
  fee: { label: "Fee", color: "orange" },
};

const StatementImportModal = ({ opened, onClose, onImported }: Props) => {
  const isMobile = useIsMobile();
  const { sqid, categories, rules, formatMoney, notifyTransactionsChanged } = useCurrentUser();
  const [picked, setPicked] = useState<File[]>([]);
  const [queue, setQueue] = useState<File[]>([]);
  const [passwordPrompt, setPasswordPrompt] = useState<{ file: File; incorrect: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [parsed, setParsed] = useState<{ label: string; rows: StatementRow[]; warnings: string[]; file: string }[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const categoryOptions = categories.map(({ value, label }) => ({ value, label }));
  const knownCategory = (value: string) => categories.some((c) => c.value === value);

  const reset = () => {
    setPicked([]);
    setQueue([]);
    setPasswordPrompt(null);
    setPassword("");
    setParsed([]);
    setRows([]);
    setProblem(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  // Marks rows already in the app (same day, amount and type), and repeats across the
  // selected statements, as duplicates so they start unticked.
  const buildPreview = async (results: typeof parsed) => {
    const all = results.flatMap((r, fi) =>
      r.rows.map((row, i) => {
        const fromRule = categoryFromRules(row.name, rules);
        const category = fromRule && knownCategory(fromRule) ? fromRule : row.category;
        return { ...row, category, id: `${fi}-${i}`, duplicate: false };
      })
    );
    if (!all.length) {
      setRows([]);
      return;
    }

    const dates = all.map((r) => r.date).sort();
    const existing = new Set<string>();
    try {
      const res = await api.get<TransactionRow[]>(`/transaction/user/${sqid}`, {
        params: {
          startDate: dayjs(dates[0]).startOf("day").toISOString(),
          endDate: dayjs(dates[dates.length - 1]).endOf("day").toISOString(),
        },
      });
      for (const t of res.data) {
        existing.add(
          `${dayjs(t.created_timestamp).format("YYYY-MM-DD")}|${Number(t.transaction_amount).toFixed(2)}|${t.transaction_type ?? "expense"}`
        );
      }
    } catch {
      setProblem("Couldn't check for transactions you've already imported. Look out for duplicates.");
    }

    const seen = new Set<string>();
    setRows(
      all.map((r) => {
        const key = `${r.date}|${r.amount.toFixed(2)}|${r.type}`;
        const duplicate = existing.has(key) || (r.include && seen.has(`${key}|${r.name}`));
        seen.add(`${key}|${r.name}`);
        return { ...r, duplicate, include: r.include && !duplicate };
      })
    );
  };

  // Reads the queued files one by one, stopping to ask when one needs a password.
  const readQueue = async (files: File[], passwordForFirst?: string, done = parsed) => {
    setReading(true);
    setProblem(null);
    let results = done;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await readStatementPdf(file, i === 0 ? passwordForFirst : undefined);
        results = [...results, { ...result, file: file.name }];
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          setParsed(results);
          setQueue(files.slice(i));
          setPasswordPrompt({ file, incorrect: err.incorrect });
          setReading(false);
          return;
        }
        results = [...results, { label: file.name, rows: [], warnings: ["Couldn't read this PDF."], file: file.name }];
      }
    }
    setParsed(results);
    setQueue([]);
    setPasswordPrompt(null);
    setPassword("");
    await buildPreview(results);
    setReading(false);
  };

  const onPick = (files: File[]) => {
    reset();
    setPicked(files);
    if (files.length) readQueue(files, undefined, []);
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    readQueue(queue, password);
  };

  const selected = rows.filter((r) => r.include);
  const spent = selected.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const received = selected.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date)), [rows]);
  const update = (id: string, change: Partial<PreviewRow>) =>
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));

  const importSelected = async () => {
    const transactions = selected.map((r) => ({
      transaction_type: r.type,
      transaction_name: r.name.slice(0, 255),
      transaction_amount: r.amount,
      // midday local time keeps the date the same in any time zone nearby
      transaction_date: dayjs(r.date).hour(12).toISOString(),
      transaction_details: {
        category: r.category,
        transaction_note: [r.note, r.source].filter(Boolean).join(" · ").slice(0, 2000),
        date_only: true,
      },
    }));
    const checked = importSchema.safeParse({ transactions: transactions.slice(0, MAX_IMPORT_ROWS) });
    if (!checked.success) {
      setProblem(describeError(checked.error));
      return;
    }
    setImporting(true);
    try {
      let imported = 0;
      for (let i = 0; i < transactions.length; i += MAX_IMPORT_ROWS) {
        const res = await api.post<{ imported: number }>("/transaction/import", {
          transactions: transactions.slice(i, i + MAX_IMPORT_ROWS),
        });
        imported += res.data.imported;
      }
      notifications.show({ message: `Imported ${imported} transactions.`, color: "green" });
      notifyTransactionsChanged();
      onImported?.(transactions.map((t) => t.transaction_date));
      close();
    } catch {
      setProblem("The import failed; nothing was saved. Try again later.");
    } finally {
      setImporting(false);
    }
  };

  const warnings = parsed.flatMap((p) => p.warnings.map((w) => `${p.label || p.file}: ${w}`));

  return (
    <Modal
      opened={opened}
      onClose={close}
      title="Import DBS/POSB statements"
      size="xl"
      centered
      fullScreen={isMobile}
      transitionProps={{ transition: isMobile ? "slide-up" : "pop" }}
    >
      <Stack>
        {!rows.length && !reading && !passwordPrompt && (
          <>
            <Alert color="teal" variant="light" icon={<IconShieldCheck size={18} />}>
              Your statement is read on this device and never uploaded. Only the transactions you choose to import are
              saved.
            </Alert>
            <Text size="sm">
              Pick your DBS or POSB <b>credit card</b> and <b>account</b> statement PDFs (the monthly e-statements from
              digibank). You can pick several at once. You&apos;ll review everything before it&apos;s saved.
            </Text>
          </>
        )}

        <FileInput
          label="Statement PDFs"
          placeholder="Choose PDF files"
          accept="application/pdf,.pdf"
          multiple
          clearable
          leftSection={<IconFileTypePdf size={16} />}
          value={picked}
          onChange={onPick}
          disabled={reading || importing}
        />

        {passwordPrompt && (
          <Card withBorder padding="md">
            <form onSubmit={submitPassword}>
              <Stack gap="xs">
                <Text size="sm">
                  <b>{passwordPrompt.file.name}</b> is password protected.
                </Text>
                <PasswordInput
                  label="PDF password"
                  description="Only used on this device to open the file."
                  leftSection={<IconLock size={16} />}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  error={passwordPrompt.incorrect ? "That password is wrong." : undefined}
                  data-autofocus
                />
                <Group justify="flex-end">
                  <Button type="submit" disabled={!password}>
                    Open
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        )}

        {reading && (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm">Reading statements…</Text>
          </Group>
        )}

        {warnings.length > 0 && (
          <Alert color="yellow" title="Check these">
            <List size="sm">
              {warnings.map((w) => (
                <List.Item key={w}>{w}</List.Item>
              ))}
            </List>
          </Alert>
        )}
        {problem && <Alert color="red">{problem}</Alert>}

        {rows.length > 0 && (
          <>
            <Group justify="space-between" gap="xs">
              <Text size="sm">
                <b>{selected.length}</b> of {rows.length} selected · spending {formatMoney(spent)} · income{" "}
                {formatMoney(received)}
              </Text>
              <Group gap="xs">
                <Button size="compact-sm" variant="subtle" onClick={() => setRows((l) => l.map((r) => ({ ...r, include: true })))}>
                  All
                </Button>
                <Button size="compact-sm" variant="subtle" onClick={() => setRows((l) => l.map((r) => ({ ...r, include: false })))}>
                  None
                </Button>
              </Group>
            </Group>
            <Text size="xs" c="dimmed">
              Payments received on a card start unticked, since they aren&apos;t income. If you import both your card and bank statements, untick the card bill payment so spending isn&apos;t counted twice.
              Lines already in the app are marked too.
            </Text>

            <Card padding={0} withBorder>
              {sorted.map((r, i) => {
                const badge = KIND_BADGE[r.kind];
                return (
                  <div key={r.id} data-testid="statement-row">
                    {i > 0 && <Divider />}
                    <Group gap="sm" wrap="nowrap" px="sm" py={8} align="flex-start" opacity={r.include ? 1 : 0.55}>
                      <Checkbox
                        mt={4}
                        aria-label={`Import ${r.name}`}
                        checked={r.include}
                        onChange={(e) => update(r.id, { include: e.currentTarget.checked })}
                      />
                      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="nowrap" gap="xs">
                          <Text fw={600} size="sm" truncate>
                            {r.name}
                          </Text>
                          <Text fw={700} size="sm" c={r.type === "income" ? "teal" : undefined} className="tabular" style={{ flexShrink: 0 }}>
                            {r.type === "income" ? "+" : ""}
                            {formatMoney(r.amount)}
                          </Text>
                        </Group>
                        <Group gap={6} wrap="wrap">
                          <Text size="xs" c="dimmed">
                            {dayjs(r.date).format("D MMM YYYY")} · {r.source}
                          </Text>
                          {badge && (
                            <Badge size="xs" variant="light" color={badge.color}>
                              {badge.label}
                            </Badge>
                          )}
                          {r.duplicate && (
                            <Badge size="xs" variant="light" color="orange">
                              Already in app
                            </Badge>
                          )}
                        </Group>
                        {r.note && (
                          <Text size="xs" c="dimmed">
                            {r.note}
                          </Text>
                        )}
                        <NativeSelect
                          aria-label={`Category for ${r.name}`}
                          size="xs"
                          w={{ base: "100%", sm: 200 }}
                          data={categoryOptions}
                          value={knownCategory(r.category) ? r.category : "other"}
                          onChange={(e) => update(r.id, { category: e.currentTarget.value })}
                        />
                      </Stack>
                    </Group>
                  </div>
                );
              })}
            </Card>

            {/* stays in view while scrolling a long statement */}
            <Group
              justify="flex-end"
              grow={isMobile}
              py="sm"
              style={{
                position: "sticky",
                bottom: 0,
                background: "var(--mantine-color-body)",
                borderTop: "1px solid var(--mantine-color-default-border)",
                zIndex: 1,
              }}
            >
              <Button variant="default" onClick={close}>
                Cancel
              </Button>
              <Button onClick={importSelected} loading={importing} disabled={!selected.length}>
                Import {selected.length} transaction{selected.length === 1 ? "" : "s"}
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};

export default StatementImportModal;
