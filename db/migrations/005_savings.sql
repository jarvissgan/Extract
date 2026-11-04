-- Savings goals and the money put into (or taken out of) them.
-- user_id copies the type of users.user_id, and foreign keys are only added on InnoDB
-- (same approach as 003_recurring.sql).
SET @user_id_type := (
  SELECT COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'user_id'
);
SET @users_innodb := (
  SELECT ENGINE = 'InnoDB' FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
);

SET @create_goal := CONCAT(
  'CREATE TABLE IF NOT EXISTS savings_goal (',
  '  goal_uuid         CHAR(36)      NOT NULL,',
  '  user_id           ', @user_id_type, ' NOT NULL,',
  '  name              VARCHAR(255)  NOT NULL,',
  '  target_amount     DECIMAL(12,2) NOT NULL,',
  '  target_date       DATE          NULL,',
  '  emoji             VARCHAR(16)   NULL,',
  '  color             VARCHAR(20)   NOT NULL DEFAULT ''pink'',',
  '  reached_timestamp DATETIME      NULL,',
  '  created_timestamp DATETIME      NOT NULL,',
  '  updated_timestamp DATETIME      NULL,',
  '  PRIMARY KEY (goal_uuid),',
  '  KEY idx_goal_user (user_id)',
  IF(@users_innodb, ', CONSTRAINT fk_goal_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE', ''),
  ')'
);
PREPARE create_goal FROM @create_goal;
EXECUTE create_goal;
DEALLOCATE PREPARE create_goal;

SET @create_entry := CONCAT(
  'CREATE TABLE IF NOT EXISTS savings_entry (',
  '  entry_uuid        CHAR(36)      NOT NULL,',
  '  goal_uuid         CHAR(36)      NOT NULL,',
  '  user_id           ', @user_id_type, ' NOT NULL,',
  -- positive = money saved, negative = money taken out
  '  amount            DECIMAL(12,2) NOT NULL,',
  '  note              VARCHAR(255)  NULL,',
  '  created_timestamp DATETIME      NOT NULL,',
  '  PRIMARY KEY (entry_uuid),',
  '  KEY idx_entry_goal (goal_uuid, created_timestamp)',
  IF(@users_innodb, ', CONSTRAINT fk_entry_goal FOREIGN KEY (goal_uuid) REFERENCES savings_goal (goal_uuid) ON DELETE CASCADE', ''),
  ')'
);
PREPARE create_entry FROM @create_entry;
EXECUTE create_entry;
DEALLOCATE PREPARE create_entry;
