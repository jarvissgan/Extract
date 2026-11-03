import { useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useSearchParams } from "react-router";
import api from "../lib/api";
import { toTransaction } from "../lib/transactions";
import type { Transaction, TransactionRow } from "../lib/types";
import { useCurrentUser } from "../context/UserContext";

// The selected month lives in the URL (?month=YYYY-MM) so it survives refreshes and links.
export const useSelectedMonth = () => {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("month");
  const parsed = fromUrl && /^\d{4}-\d{2}$/.test(fromUrl) ? dayjs(`${fromUrl}-01`) : dayjs();
  const month = parsed.startOf("month");

  const setMonth = (value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set("month", dayjs(value).format("YYYY-MM"));
    else next.delete("month");
    setParams(next, { replace: true });
  };

  return { month, setMonth };
};

export const useMonthTransactions = (month: Dayjs) => {
  const { sqid, transactionsVersion } = useCurrentUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const startDate = month.startOf("month").format("YYYY-MM-DD 00:00:00");
  const endDate = month.endOf("month").format("YYYY-MM-DD 23:59:59");

  useEffect(() => {
    if (!sqid) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    api
      .get<TransactionRow[]>(`/transaction/user/${sqid}`, { params: { startDate, endDate } })
      .then((res) => {
        if (!cancelled) setTransactions(res.data.map(toTransaction));
      })
      .catch((err) => {
        console.error(`Unable to load transactions for ${sqid}`, err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sqid, startDate, endDate, transactionsVersion]);

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return { transactions, total, loading, error };
};
