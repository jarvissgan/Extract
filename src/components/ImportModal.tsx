import { useState } from "react";
import { Alert, Button, Code, FileInput, Group, List, Modal, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconFileUpload } from "@tabler/icons-react";
import api, { errorStatus } from "../lib/api";
import { csvToImportRows, type ImportRow } from "../lib/csv";
import { useCurrentUser } from "../context/UserContext";
import { describeError, importSchema, MAX_IMPORT_ROWS } from "../../shared/schemas.js";

interface Props {
  opened: boolean;
  onClose: () => void;
  // called with the dates (ISO) of the imported transactions
  onImported?: (dates: string[]) => void;
}

const ImportModal = ({ opened, onClose, onImported }: Props) => {
  const { categories, rules, notifyTransactionsChanged } = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const close = () => {
    setFile(null);
    setRows([]);
    setErrors([]);
    onClose();
  };

  const onFile = async (picked: File | null) => {
    setFile(picked);
    setRows([]);
    setErrors([]);
    if (!picked) return;

    const result = csvToImportRows(await picked.text(), categories, rules);
    const problems = [...result.errors];
    if (result.rows.length) {
      const checked = importSchema.safeParse({ transactions: result.rows });
      if (!checked.success) problems.push(describeError(checked.error).replace(/^transactions\.(\d+)\./, (_: string, i: string) => `Row ${Number(i) + 1}: `));
    }
    setRows(result.rows);
    setErrors(problems);
  };

  const submit = async () => {
    setImporting(true);
    try {
      const res = await api.post<{ imported: number }>("/transaction/import", { transactions: rows });
      notifications.show({ message: `Imported ${res.data.imported} transactions.`, color: "green" });
      notifyTransactionsChanged();
      onImported?.(rows.map((r) => r.transaction_date));
      close();
    } catch (error) {
      notifications.show({
        title: "Import failed",
        message: errorStatus(error) === 400 ? "Some rows are invalid." : "Issues contacting server. Try again later.",
        color: "red",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Import transactions from CSV" centered size="lg">
      <Stack>
        <Text size="sm">
          The first row must be a header with <Code>date</Code>, <Code>name</Code> and <Code>amount</Code>, and
          optionally <Code>type</Code> (expense or income), <Code>category</Code> and <Code>note</Code>. Blank
          categories are filled in from your rules. Dates like <Code>2026-11-04</Code> or{" "}
          <Code>4/11/2026</Code> work. Up to {MAX_IMPORT_ROWS} rows at a time. Files from <b>Export CSV</b> can be
          imported as-is.
        </Text>
        <FileInput
          label="CSV file"
          placeholder="Choose a file"
          accept=".csv,text/csv"
          leftSection={<IconFileUpload size={16} />}
          value={file}
          onChange={onFile}
          clearable
        />
        {errors.length > 0 && (
          <Alert color="red" title="Fix these before importing">
            <List size="sm">
              {errors.slice(0, 8).map((e) => (
                <List.Item key={e}>{e}</List.Item>
              ))}
              {errors.length > 8 && <List.Item>…and {errors.length - 8} more</List.Item>}
            </List>
          </Alert>
        )}
        {file && !errors.length && rows.length > 0 && (
          <Alert color="teal">{rows.length} transactions ready to import.</Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} loading={importing} disabled={!rows.length || errors.length > 0}>
            Import
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ImportModal;
