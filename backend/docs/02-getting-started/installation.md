# Installation

Run commands from the backend repository root (the directory containing `package.json`).

## 1. Check the runtime

```bash
node --version
npm --version
```

Node.js must satisfy the `engines.node` declaration in `package.json` (`>=20.19.0`).

## 2. Install dependencies

```bash
npm install
```

This installs dependencies and development dependencies recorded in the lockfile.

## 3. Create a local environment file

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

Do not commit `.env`. The repository `.gitignore` should exclude local secrets; verify this before committing.

## 4. Configure required values

Edit `.env` and provide:

- `CLIENT_URL`
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

The environment module fails during startup if a required variable is missing or empty. See [Environment setup](environment-setup.md).

## 5. Start the backend

```bash
npm run dev
```

The default port is `5000`, and the default API prefix is `/api/v1`.

## 6. Verify health endpoints

The health router is mounted at `/api/v1/health`. The implementation exposes:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

The readiness endpoint should be used to check the dependencies it actually evaluates; consult `src/modules/health/health.controller.js` for the precise response and checks.

## 7. Initialize the first administrator

Only when setting up a new Ascendra database, configure the `INITIAL_ADMIN_*` values and run:

```bash
npm run bootstrap
```

See [Bootstrap](../11-deployment-and-operations/bootstrap.md) before running it against any database with existing records.
