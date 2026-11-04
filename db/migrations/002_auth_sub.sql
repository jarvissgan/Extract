-- Link accounts to the Auth0 user ID ("sub") instead of relying on email.
-- Existing accounts are linked automatically the next time their owner logs in.
--
-- Works on MySQL 8 and MariaDB: MySQL has no ADD COLUMN IF NOT EXISTS, so each change
-- checks information_schema first and runs only if needed (safe to re-run).

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'auth_sub') = 0,
  'ALTER TABLE users ADD COLUMN auth_sub VARCHAR(255) NULL AFTER user_id',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_auth_sub') = 0,
  'ALTER TABLE users ADD UNIQUE INDEX uq_users_auth_sub (auth_sub)',
  'DO 0');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
