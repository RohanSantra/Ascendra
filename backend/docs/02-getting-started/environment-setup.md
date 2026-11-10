# Environment setup

Environment configuration is loaded by `dotenv/config` in `src/config/env.js`. The module exports a frozen configuration object and validates required values during import.

## Required settings

| Variable | Default | Required | Purpose |
|---|---:|---:|---|
| `CLIENT_URL` | — | Yes | Allowed frontend origin for CORS |
| `MONGODB_URI` | — | Yes | MongoDB connection string |
| `JWT_ACCESS_SECRET` | — | Yes | Secret used to sign/verify access tokens |
| `JWT_REFRESH_SECRET` | — | Yes | Secret used to sign/verify refresh tokens |

## Application

| Variable | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | Environment label used by application utilities |
| `APP_NAME` | `ASCENDRA` | Application name included in startup logs |
| `API_VERSION` | `v1` | Version segment mounted below `/api/` |
| `PORT` | `5000` | HTTP listening port; must be a positive integer |

## Authentication

| Variable | Default | Purpose |
|---|---|---|
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access-token lifetime passed to token utility |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token lifetime |
| `JWT_REFRESH_COOKIE_NAME` | `refreshToken` | Refresh-token cookie name |
| `JWT_REFRESH_COOKIE_MAX_AGE` | `604800000` | Refresh cookie max age in milliseconds |
| `BCRYPT_SALT_ROUNDS` | `12` | bcrypt work factor; parsed as a positive integer |

Generate strong, independent secrets for access and refresh tokens. Do not use the example file's blank placeholders.

## Email (optional until email delivery is used)

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST` | empty | SMTP host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | Whether SMTP transport uses secure TLS mode |
| `SMTP_USER` | empty | SMTP username |
| `SMTP_PASSWORD` | empty | SMTP password |
| `EMAIL_FROM` | empty | Sender identity |

Inspect `src/core/utils/email.service.js` for transport creation and runtime behavior. Do not assume email is delivered merely because the variables are present.

## Bootstrap-only values

| Variable | Default | Purpose |
|---|---|---|
| `INITIAL_ORG_NAME` | `Ascendra` | Initial organization name |
| `INITIAL_ORG_SLUG` | `ascendra` | Initial organization slug |
| `INITIAL_ADMIN_FIRST_NAME` | empty | Initial administrator first name |
| `INITIAL_ADMIN_LAST_NAME` | empty | Initial administrator last name |
| `INITIAL_ADMIN_EMAIL` | empty | Initial administrator email |
| `INITIAL_ADMIN_PASSWORD` | empty | Initial administrator password; minimum 12 characters in bootstrap validation |

These values are read by `scripts/bootstrap.js`. They are not needed for ordinary server startup. Remove or protect bootstrap credentials after initial setup according to your secret-management process.

## Cloudinary (optional until storage is used)

| Variable | Default | Purpose |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | empty | Cloudinary account name |
| `CLOUDINARY_API_KEY` | empty | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | empty | Cloudinary API secret |

The Cloudinary values are optional in the environment loader, but upload workflows may require them. Review the course-material storage implementation before enabling uploads.

## Parsing rules

- Required strings must be present and non-empty.
- Optional strings fall back to documented defaults.
- Numeric settings are parsed as positive safe integers; invalid values throw during configuration loading.
- Boolean `SMTP_SECURE` is interpreted by comparing its lowercased string value to `"true"`.

The authoritative list and defaults are in `.env.example` and `src/config/env.js`.
