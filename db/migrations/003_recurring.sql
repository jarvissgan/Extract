-- Monthly recurring transactions (rent, subscriptions...).
--
-- user_id copies the exact type of users.user_id (INT, INT UNSIGNED, BIGINT...), because
-- existing databases may differ from 001_initial.sql. The foreign key is only added when
-- `users` uses InnoDB; otherwise the API deletes a user's rules itself.
SET @user_id_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id'
);
SET @users_innodb := (
  SELECT ENGINE = 'InnoDB' FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
);

SET @create_recurring := CONCAT(
  'CREATE TABLE IF NOT EXISTS recurring_transaction (',
  '  recurring_uuid        CHAR(36)         NOT NULL,',
  '  user_id               ', @user_id_type, ' NOT NULL,',
  '  name                  VARCHAR(255)     NOT NULL,',
  '  amount                DECIMAL(12,2)    NOT NULL,',
  '  category              VARCHAR(40)      NOT NULL DEFAULT ''other'',',
  '  note                  TEXT             NULL,',
  '  day_of_month          TINYINT UNSIGNED NOT NULL,',
  '  active                BOOLEAN          NOT NULL DEFAULT TRUE,',
  -- first month (YYYY-MM, UTC) to generate, and the last one generated so far
  '  start_period          CHAR(7)          NOT NULL,',
  '  last_generated_period CHAR(7)          NULL,',
  '  created_timestamp     DATETIME         NOT NULL,',
  '  updated_timestamp     DATETIME         NULL,',
  '  PRIMARY KEY (recurring_uuid),',
  '  KEY idx_recurring_user (user_id)',
  IF(@users_innodb,
     ', CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE',
     ''),
  ')'
);
PREPARE create_recurring FROM @create_recurring;
EXECUTE create_recurring;
DEALLOCATE PREPARE create_recurring;

-- Generated transactions remember which rule and month they came from, so each
-- month is only ever generated once. (Checked first, as MySQL has no ADD ... IF NOT EXISTS.)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction' AND COLUMN_NAME = 'recurring_uuid') = 0,
  'ALTER TABLE `transaction` ADD COLUMN recurring_uuid CHAR(36) NULL',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction' AND COLUMN_NAME = 'recurring_period') = 0,
  'ALTER TABLE `transaction` ADD COLUMN recurring_period CHAR(7) NULL',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transaction' AND INDEX_NAME = 'uq_transaction_recurring') = 0,
  'ALTER TABLE `transaction` ADD UNIQUE INDEX uq_transaction_recurring (recurring_uuid, recurring_period)',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
