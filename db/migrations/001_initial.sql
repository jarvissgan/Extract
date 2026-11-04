-- Base schema. Uses IF NOT EXISTS so it's safe to run against an existing database.

CREATE TABLE IF NOT EXISTS users (
  user_id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_sqid         VARCHAR(32)  NULL,
  username          VARCHAR(255) NOT NULL,
  user_details      JSON         NULL,
  preference_json   JSON         NULL,
  email             VARCHAR(255) NOT NULL,
  account_status    JSON         NULL,
  created_timestamp DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_timestamp DATETIME     NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_sqid (user_sqid)
);

CREATE TABLE IF NOT EXISTS `transaction` (
  transaction_uuid    CHAR(36)      NOT NULL,
  user_id             INT UNSIGNED  NOT NULL,
  transaction_name    VARCHAR(255)  NOT NULL,
  transaction_amount  DECIMAL(12,2) NOT NULL,
  transaction_details JSON          NULL,
  created_timestamp   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_timestamp   DATETIME      NULL,
  PRIMARY KEY (transaction_uuid),
  KEY idx_transaction_user_created (user_id, created_timestamp),
  CONSTRAINT fk_transaction_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
);
