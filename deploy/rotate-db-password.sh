#!/usr/bin/env bash
# Changes the app's database password: updates MariaDB and deploy/.env together, then
# restarts the app. Save the new password in your password manager.
#
#   sudo ./deploy/rotate-db-password.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
load_env

new="$(openssl rand -hex 24)"

say "Changing the password in MariaDB"
docker exec -e NEW_PASSWORD="$new" extract-mariadb sh -c \
  'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "ALTER USER \`$MARIADB_USER\`@\`%\` IDENTIFIED BY \"$NEW_PASSWORD\"; FLUSH PRIVILEGES;"'

say "Updating deploy/.env"
umask 077
sed -i "s|^DB_PASSWORD=.*|DB_PASSWORD=$new|" "$ENV_FILE"
chmod 600 "$ENV_FILE"

say "Restarting the app with the new password"
compose up -d app
wait_healthy

cat <<DONE

  New Extract database password (save it in your password manager):
  $new
DONE
