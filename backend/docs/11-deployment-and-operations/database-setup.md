# Database setup

## Connection

Set `MONGODB_URI` to the target database connection string. The application uses `connectDatabase()` from `src/config/db.js` and connects before opening the HTTP listener.

## Replica set requirement

Transactions are used by bootstrap and trainer assignment/capacity workflows. Use a replica set or compatible MongoDB deployment. For local development, a single-node replica set is sufficient.

## Credentials and network

- Create a dedicated database user with only the permissions required by the application.
- Restrict network access to backend instances and approved operators.
- Use TLS where supported by the deployment.
- Keep the URI out of Git and logs.

## Indexes

Mongoose model files declare indexes. Confirm deployed index state against the database, especially after schema changes. Unique indexes may fail to build if existing data contains duplicates.

## Backup and restore

The repository does not implement a backup scheduler. Configure managed or operator-controlled backups, define retention, and test restores. A backup that has never been restored is not a verified recovery plan.
