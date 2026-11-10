# Configuration

## Source of truth

Environment configuration is loaded in `src/config/env.js` using `dotenv/config`. The module exposes a frozen `env` object through `src/config/index.js`.

## Parsing helpers

- `getRequiredEnv(name)` rejects missing or whitespace-only values.
- `getOptionalEnv(name, defaultValue)` returns a configured non-empty string or its default.
- `getNumberEnv(name, defaultValue)` requires a positive safe integer.

The exported object groups settings under `app`, `client`, `database`, `auth`, `email`, `bootstrap`, and `cloudinary`.

## Required configuration

The loader requires `CLIENT_URL`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`. Importing configuration can therefore fail before the server starts if these values are missing.

## Defaults

The defaults are defined directly in `src/config/env.js`; the complete variable table is in [Environment variables](../12-reference/environment-variables.md). Do not duplicate default values in source code or documentation when the environment module already owns them.

## Adding a setting

1. Add a safe placeholder to `.env.example`.
2. Parse it through the appropriate helper in `env.js`.
3. Place it in the relevant configuration group.
4. Document whether it is required and its default.
5. Add tests in `test/unit/config/env.test.js`.
6. Avoid logging secret values.

## Database configuration

`src/config/db.js` owns connection options and connection lifecycle. Do not create per-module database connections.
