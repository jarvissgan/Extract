import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Group, Text } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import api from "../lib/api";
import { parseJson, type TransactionDetails, type TransactionType } from "../lib/types";
import { useCurrentUser } from "./UserContext";
import AddTransactionModal from "../components/AddTransactionModal";

export interface Suggestion {
  name: string;
  type: TransactionType;
  amount: number;
  category: string;
  note: string;
  uses: number;
}

export interface EntryPrefill {
  type?: TransactionType;
  name?: string;
  amount?: number | string;
  category?: string;
  note?: string;
}

interface SuggestionRow {
  name: string;
  type: TransactionType;
  amount: number | string;
  details: string | TransactionDetails | null;
  uses: number;
}

interface TransactionEntryValue {
  openAdd: (prefill?: EntryPrefill) => void;
  suggestions: Suggestion[];
  // shows "Added …" with an Undo button that deletes the new transaction
  confirmAdded: (uuid: string, label: string) => void;
}

const TransactionEntryContext = createContext<TransactionEntryValue | null>(null);

export const TransactionEntryProvider = ({ children }: { children: ReactNode }) => {
  const { status, transactionsVersion, notifyTransactionsChanged } = useCurrentUser();
  const [opened, setOpened] = useState(false);
  const [prefill, setPrefill] = useState<EntryPrefill | undefined>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const ready = status === "ready";

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api
      .get<SuggestionRow[]>("/transaction/suggestions")
      .then((res) => {
        if (cancelled) return;
        setSuggestions(
          res.data.map((r) => {
            const details = parseJson(r.details, {} as TransactionDetails);
            return {
              name: r.name,
              type: r.type === "income" ? "income" : "expense",
              amount: Number(r.amount),
              category: details.category || "other",
              note: details.transaction_note || "",
              uses: Number(r.uses),
            };
          })
        );
      })
      .catch(() => {
        // suggestions are a nice-to-have
      });
    return () => {
      cancelled = true;
    };
  }, [ready, transactionsVersion]);

  const openAdd = useCallback((next?: EntryPrefill) => {
    setPrefill(next);
    setOpened(true);
  }, []);

  const confirmAdded = useCallback(
    (uuid: string, label: string) => {
      const id = notifications.show({
        color: "green",
        autoClose: 6000,
        message: (
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text size="sm">Added {label}</Text>
            <Button
              size="compact-xs"
              variant="light"
              onClick={async () => {
                notifications.hide(id);
                try {
                  await api.delete(`/transaction/${uuid}`);
                  notifyTransactionsChanged();
                  notifications.show({ message: "Undone.", color: "gray", autoClose: 2500 });
                } catch {
                  notifications.show({ message: "Couldn't undo. Delete it from the list instead.", color: "red" });
                }
              }}
            >
              Undo
            </Button>
          </Group>
        ),
      });
    },
    [notifyTransactionsChanged]
  );

  // N anywhere (outside text fields) opens the add dialog
  useHotkeys(ready ? [["n", () => openAdd()]] : []);

  const value = useMemo(() => ({ openAdd, suggestions, confirmAdded }), [openAdd, suggestions, confirmAdded]);

  return (
    <TransactionEntryContext.Provider value={value}>
      {children}
      {ready && <AddTransactionModal opened={opened} onClose={() => setOpened(false)} prefill={prefill} />}
    </TransactionEntryContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTransactionEntry = () => {
  const ctx = useContext(TransactionEntryContext);
  if (!ctx) throw new Error("useTransactionEntry must be used inside <TransactionEntryProvider>");
  return ctx;
};
