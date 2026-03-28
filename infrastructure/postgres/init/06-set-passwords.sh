#!/bin/bash
# Set service account passwords from environment variables.
# Runs after 03/04/05 SQL scripts which create the roles with placeholder passwords.
# If an env var is unset, the role keeps its placeholder (will fail to authenticate).

set -e

if [ -n "$DB_RO_PASSWORD" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -c "ALTER ROLE splashworks_ro WITH PASSWORD '$DB_RO_PASSWORD';"
    echo "Set password for splashworks_ro"
fi

if [ -n "$DB_RIPPLE_PASSWORD" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -c "ALTER ROLE ripple_rw WITH PASSWORD '$DB_RIPPLE_PASSWORD';"
    echo "Set password for ripple_rw"
fi

if [ -n "$DB_METABASE_PASSWORD" ]; then
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -c "ALTER ROLE metabase_ro WITH PASSWORD '$DB_METABASE_PASSWORD';"
    echo "Set password for metabase_ro"
fi
