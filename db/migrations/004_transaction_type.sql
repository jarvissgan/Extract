-- Income as well as spending. Existing rows are expenses.
ALTER TABLE `transaction`
  ADD COLUMN IF NOT EXISTS transaction_type ENUM('expense', 'income') NOT NULL DEFAULT 'expense';

ALTER TABLE recurring_transaction
  ADD COLUMN IF NOT EXISTS transaction_type ENUM('expense', 'income') NOT NULL DEFAULT 'expense';
