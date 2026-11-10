# Production configuration

## Environment

Set `NODE_ENV=production` and provide all required environment variables. Use deployment secret management rather than a committed `.env` file.

Required:
- `CLIENT_URL`
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Configure token expiry, cookie name/max age, SMTP and Cloudinary settings according to the intended feature set. See [Environment variables](../12-reference/environment-variables.md).

## HTTP and frontend

`CLIENT_URL` must match the browser application's origin. CORS allows credentials and a fixed set of methods/headers. The refresh cookie is HTTP-only and secure when `NODE_ENV` is `production`.

The refresh-cookie path follows the configured API version (`/api/{API_VERSION}/auth`; default `/api/v1/auth`), so the cookie remains scoped to the auth endpoints when the API version changes.

## Database

Use a production MongoDB replica set or compatible deployment for transaction workflows. Use a least-privilege database account and network restrictions. Ensure indexes are built and monitored.

## Secrets

- Generate independent high-entropy JWT secrets.
- Protect SMTP and Cloudinary credentials.
- Do not put credentials in logs, images, source code, changelog, issue trackers or documentation.
- Rotate credentials using the deployment platform's supported process.

## Process

Run `npm start` under a process supervisor or platform that restarts failed processes and forwards SIGTERM/SIGINT correctly. The application handles these signals and performs graceful shutdown.
