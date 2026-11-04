import { useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { useSearchParams } from "react-router";
import api from "../lib/api";
import { expensesOf, incomeOf, sumAmounts, toTransaction } from "../lib/transactions";
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

// Loads the signed-in user's transactions between two local-time instants.
export const useRangeTransactions = (start: Dayjs, end: Dayjs) => {
  const { sqid, transactionsVersion } = useCurrentUser();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // exact instants, so the server (which stores UTC) filters on the user's local time
  const startDate = start.toISOString();
  const endDate = end.toISOString();

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

  const spent = sumAmounts(expensesOf(transactions));
  const income = sumAmounts(incomeOf(transactions));

  return { transactions, spent, income, loading, error };
};

export const useMonthTransactions = (month: Dayjs) =>
  useRangeTransactions(month.startOf("month"), month.endOf("month"));
