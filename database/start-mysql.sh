#!/usr/bin/env bash
# Start the project-local MySQL server (binary under .mysql/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MYSQL_HOME="$ROOT/.mysql"
SOCK="$MYSQL_HOME/mysql.sock"

if [[ ! -x "$MYSQL_HOME/server/bin/mysqld" ]]; then
  echo "MySQL binary not found at $MYSQL_HOME/server. Install MySQL locally first."
  exit 1
fi

if "$MYSQL_HOME/server/bin/mysqladmin" --socket="$SOCK" -uroot ping --silent 2>/dev/null; then
  echo "MySQL already running."
  exit 0
fi

mkdir -p "$MYSQL_HOME/tmp" "$MYSQL_HOME/logs"
rm -f "$SOCK" "$MYSQL_HOME/mysqld.pid"

"$MYSQL_HOME/server/bin/mysqld" \
  --no-defaults \
  --datadir="$MYSQL_HOME/data" \
  --basedir="$MYSQL_HOME/server" \
  --port=3306 \
  --socket="$SOCK" \
  --pid-file="$MYSQL_HOME/mysqld.pid" \
  --tmpdir="$MYSQL_HOME/tmp" \
  --log-error="$MYSQL_HOME/logs/error.log" \
  --bind-address=127.0.0.1 &

for i in $(seq 1 60); do
  if "$MYSQL_HOME/server/bin/mysqladmin" --socket="$SOCK" -uroot ping --silent 2>/dev/null; then
    echo "MySQL ready (socket: $SOCK)"
    exit 0
  fi
  sleep 1
done

echo "MySQL failed to start. See $MYSQL_HOME/logs/error.log"
exit 1
