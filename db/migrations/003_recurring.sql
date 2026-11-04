-- Monthly recurring transactions (rent, subscriptions...).
CREATE TABLE IF NOT EXISTS recurring_transaction (
  recurring_uuid        CHAR(36)         NOT NULL,
  user_id               INT UNSIGNED     NOT NULL,
  name                  VARCHAR(255)     NOT NULL,
  amount                DECIMAL(12,2)    NOT NULL,
  category              VARCHAR(40)      NOT NULL DEFAULT 'other',
  note                  TEXT             NULL,
  day_of_month          TINYINT UNSIGNED NOT NULL,
  active                BOOLEAN          NOT NULL DEFAULT TRUE,
  -- first month (YYYY-MM, UTC) to generate, and the last one generated so far
  start_period          CHAR(7)          NOT NULL,
  last_generated_period CHAR(7)          NULL,
  created_timestamp     DATETIME         NOT NULL,
  updated_timestamp     DATETIME         NULL,
  PRIMARY KEY (recurring_uuid),
  KEY idx_recurring_user (user_id),
  CONSTRAINT fk_recurring_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);

-- Generated transactions remember which rule and month they came from, so each
-- month is only ever generated once.
ALTER TABLE `transaction`
  ADD COLUMN IF NOT EXISTS recurring_uuid CHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS recurring_period CHAR(7) NULL,
  ADD UNIQUE INDEX IF NOT EXISTS uq_transaction_recurring (recurring_uuid, recurring_period);
