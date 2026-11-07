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
import { IconFileUpload, IconLock, IconShieldCheck } from "@tabler/icons-react";
import dayjs from "dayjs";
import api from "../lib/api";
import { readStatementPdf, PdfPasswordError, type StatementRow } from "../lib/pdfStatement";
import { csvToStatement } from "../lib/csv";
import { findDuplicates } from "../../shared/importDuplicates.js";
import type { TransactionRow } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";
import { useIsMobile } from "../hooks/useIsMobile";
import { categoryFromRules, describeError, importSchema, MAX_IMPORT_ROWS } from "../../shared/schemas.js";

// PDFs: DBS/POSB statements. CSVs: digibank transaction history, or any CSV with date,
// name and amount columns. Several files of either kind can be picked (or dropped) at once.
const isCsv = (file: File) => /\.(csv|txt)$/i.test(file.name) || /csv|text\/plain/.test(file.type);

interface PreviewRow extends StatementRow {
  id: string;
  file: string;
  // "app": already in the app; "file": also in another picked file
  duplicate: "app" | "file" | null;
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

  // Marks rows already in the app, and the same transaction appearing in two of the picked
  // files, as duplicates so they start unticked (see shared/importDuplicates.js).
  const buildPreview = async (results: typeof parsed) => {
    const all = results.flatMap((r, fi) =>
      r.rows.map((row, i) => {
        const fromRule = row.categoryGuessed === false ? null : categoryFromRules(row.name, rules);
        const category = fromRule && knownCategory(fromRule) ? fromRule : row.category;
        return { ...row, category, id: `${fi}-${i}`, file: r.file, duplicate: null };
      }),
    );
    if (!all.length) {
      setRows([]);
      return;
    }

    const dates = all.map((r) => r.date).sort();
    const existing: { date: string; amount: number; type: string; name: string }[] = [];
    try {
      const res = await api.get<TransactionRow[]>(`/transaction/user/${sqid}`, {
        params: {
          startDate: dayjs(dates[0]).startOf("day").toISOString(),
          endDate: dayjs(dates[dates.length - 1])
            .endOf("day")
            .toISOString(),
        },
      });
      for (const t of res.data) {
        existing.push({
          date: dayjs(t.created_timestamp).format("YYYY-MM-DD"),
          amount: Number(t.transaction_amount),
          type: t.transaction_type ?? "expense",
          name: t.transaction_name,
        });
      }
    } catch {
      setProblem("Couldn't check for transactions you've already imported. Look out for duplicates.");
    }

    const found = findDuplicates(all, existing);
    setRows(all.map((r, i) => ({ ...r, duplicate: found[i], include: r.include && !found[i] })));
  };

  // Reads the queued files one by one, stopping to ask when one needs a password.
  const readQueue = async (files: File[], passwordForFirst?: string, done = parsed) => {
    setReading(true);
    setProblem(null);
    let results = done;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = isCsv(file)
          ? csvToStatement(await file.text(), file.name, categories, rules)
          : await readStatementPdf(file, i === 0 ? passwordForFirst : undefined);
        results = [...results, { ...result, file: file.name }];
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          setParsed(results);
          setQueue(files.slice(i));
          setPasswordPrompt({ file, incorrect: err.incorrect });
          setReading(false);
          return;
        }
        results = [
          ...results,
          {
            label: file.name,
            rows: [],
            warnings: [`Couldn't read this ${isCsv(file) ? "file" : "PDF"}.`],
            file: file.name,
          },
        ];
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
      transaction_date: r.at ?? dayjs(r.date).hour(12).toISOString(),
      transaction_details: {
        category: r.category,
        // statements note which card/account it came from; a CSV's file name isn't useful
        // note which card/account it came from (a plain CSV's source is just its file name)
        transaction_note: [r.note, r.source !== r.file && r.source].filter(Boolean).join(" · ").slice(0, 2000),
        ...(r.at ? {} : { date_only: true }),
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
      title="Import transactions"
      size="xl"
      centered
      fullScreen={isMobile}
      transitionProps={{ transition: isMobile ? "slide-up" : "pop" }}
    >
      <Stack>
        {!rows.length && !reading && !passwordPrompt && (
          <>
            <Alert color="teal" variant="light" icon={<IconShieldCheck size={18} />}>
              Your files are read on this device and never uploaded. Only the transactions you choose to import are
              saved.
            </Alert>
            <Text size="sm">You can pick several files at once, PDFs and CSVs mixed:</Text>
            <List size="sm" spacing={4}>
              <List.Item>
                DBS/POSB <b>credit card</b> and <b>account</b> statement PDFs (the monthly e-statements)
              </List.Item>
              <List.Item>
                The <b>transaction history</b> CSV from digibank
              </List.Item>
              <List.Item>
                Any CSV with <b>date</b>, <b>name</b> and <b>amount</b> columns (optionally type, category and note),
                including files from <b>Export CSV</b>
              </List.Item>
            </List>
            <Text size="sm" c="dimmed">
              You&apos;ll review everything before it&apos;s saved.
            </Text>
          </>
        )}

        <div
          data-testid="import-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const files = [...e.dataTransfer.files].filter((f) => isCsv(f) || /\.pdf$/i.test(f.name));
            if (files.length && !reading && !importing) onPick(files);
          }}
        >
          <FileInput
            label="Files"
            placeholder={isMobile ? "Choose PDF or CSV files" : "Choose or drop PDF / CSV files"}
            accept="application/pdf,.pdf,text/csv,.csv"
            multiple
            clearable
            leftSection={<IconFileUpload size={16} />}
            value={picked}
            onChange={onPick}
            disabled={reading || importing}
          />
        </div>

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
            <Text size="sm">Reading files…</Text>
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
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={() => setRows((l) => l.map((r) => ({ ...r, include: true })))}
                >
                  All
                </Button>
                <Button
                  size="compact-sm"
                  variant="subtle"
                  onClick={() => setRows((l) => l.map((r) => ({ ...r, include: false })))}
                >
                  None
                </Button>
              </Group>
            </Group>
            <Text size="xs" c="dimmed">
              {rows.some((r) => r.kind === "transfer") &&
                "Payments received on a card start unticked, since they aren't income. If you import both your card and bank statements, untick the card bill payment so spending isn't counted twice. "}
              Lines already in the app start unticked and are marked.
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
                          <Text
                            fw={700}
                            size="sm"
                            c={r.type === "income" ? "teal" : undefined}
                            className="tabular"
                            style={{ flexShrink: 0 }}
                          >
                            {r.type === "income" ? "+" : ""}
                            {formatMoney(r.amount)}
                          </Text>
                        </Group>
                        <Group gap={6} wrap="wrap">
                          <Text size="xs" c="dimmed">
                            {r.at ? dayjs(r.at).format("D MMM YYYY, h:mm A") : dayjs(r.date).format("D MMM YYYY")}
                            {r.source && ` · ${r.source}`}
                          </Text>
                          {badge && (
                            <Badge size="xs" variant="light" color={badge.color}>
                              {badge.label}
                            </Badge>
                          )}
                          {r.duplicate && (
                            <Badge size="xs" variant="light" color="orange">
                              {r.duplicate === "app" ? "Already in app" : "In another file"}
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
