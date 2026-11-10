# Bootstrap

## Purpose

`scripts/bootstrap.js` initializes the first Ascendra records:
1. A global Platform Administrator user.
2. An active Ascendra organization (name and slug configurable).
3. An approved `admin` membership linking the administrator to the organization.

The operation runs in a MongoDB transaction.

## Configuration

Set:
- `INITIAL_ORG_NAME` (default `Ascendra`)
- `INITIAL_ORG_SLUG` (default `ascendra`)
- `INITIAL_ADMIN_FIRST_NAME`
- `INITIAL_ADMIN_LAST_NAME`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

Bootstrap requires all admin values. It normalizes slug/email, validates slug and email formats, and requires an admin password of at least 12 characters.

## Run

```bash
npm run bootstrap
```

Run it from the backend root after configuring `.env` and verifying `MONGODB_URI` points to the intended database.

## Idempotency and conflicts

If the configured organization and administrator already exist and their platform role, statuses and approved admin membership match the expected completed state, the script reports that bootstrap is already complete and makes no changes.

If only part of the setup exists or conflicting records are found, the script stops instead of creating a second initial setup. It also refuses to create another platform administrator if one already exists.

## Safety

- Treat the bootstrap password as a secret.
- Do not run against production until the database target has been independently verified.
- Remove bootstrap credentials from runtime configuration after initial setup where operationally appropriate.
- Do not run bootstrap as part of every server startup.
