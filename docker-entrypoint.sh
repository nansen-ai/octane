#!/bin/sh
set -e
echo "Custom docker-entrypoint.sh starting..."

# Source environment variables from init container if available
if [ -f /mnt/.env ]; then
  echo "Loading environment variables from init container..."
  set -a
  . /mnt/.env
  set +a
  echo "Environment variables loaded successfully"
else
  echo "No environment variables file found, continuing with defaults"
fi

echo "Starting application with command: \"$@\""

# Execute the CMD
exec "$@"