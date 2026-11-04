-- Income as well as spending. Existing rows are expenses.
-- Checked first, so it works on MySQL 8 and MariaDB and is safe to re-run.

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction' AND COLUMN_NAME = 'transaction_type') = 0,
  'ALTER TABLE `transaction` ADD COLUMN transaction_type ENUM(''expense'', ''income'') NOT NULL DEFAULT ''expense''',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'recurring_transaction' AND COLUMN_NAME = 'transaction_type') = 0,
  'ALTER TABLE recurring_transaction ADD COLUMN transaction_type ENUM(''expense'', ''income'') NOT NULL DEFAULT ''expense''',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
