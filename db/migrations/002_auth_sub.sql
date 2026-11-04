-- Link accounts to the Auth0 user ID ("sub") instead of relying on email.
-- Existing accounts are linked automatically the next time their owner logs in.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_sub VARCHAR(255) NULL AFTER user_id,
  ADD UNIQUE INDEX IF NOT EXISTS uq_users_auth_sub (auth_sub);
