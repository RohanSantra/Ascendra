# Prerequisites

## Required software

| Requirement | Version / detail | Why it is needed |
|---|---|---|
| Node.js | `>=20.19.0` as declared in `package.json` | Runs the ES-module backend and built-in test runner |
| npm | Bundled with a supported Node.js installation | Installs dependencies and runs scripts |
| MongoDB | A reachable deployment | Stores application data |
| Git | Any current version | Source control and collaboration |

Use `node --version` and `npm --version` to inspect local versions.

## MongoDB requirements

The application connects using `MONGODB_URI`. Some workflows use MongoDB transactions. A standalone MongoDB server does not support multi-document transactions; use a replica set for local and production environments where those workflows are exercised.

The integration tests use `mongodb-memory-server` through the shared test database helper. The test setup is not a replacement for a production MongoDB deployment.

## Optional integrations

- SMTP credentials are needed to exercise email delivery through Nodemailer.
- Cloudinary credentials are needed for the configured Cloudinary course-material storage workflow.
- A frontend is not required to run the API, but `CLIENT_URL` must be configured because it is a required application setting and is used by CORS.

## Before continuing

Confirm that the MongoDB URI points to a database intended for development, not production. Never use production credentials in a local `.env` file that may be committed.
