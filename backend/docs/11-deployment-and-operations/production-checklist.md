# Production checklist

## Application

- [ ] Node.js version satisfies `>=20.19.0`.
- [ ] `NODE_ENV=production`.
- [ ] `npm run check` passes on the release candidate.
- [ ] Current coverage has been reviewed.
- [ ] No local `.env`, credentials, tokens or private keys are committed.
- [ ] CORS `CLIENT_URL` is correct.
- [ ] API version and refresh-cookie path are compatible.

## Database

- [ ] MongoDB URI targets the intended production database.
- [ ] Replica set / transaction support is available.
- [ ] Database user uses least privilege.
- [ ] Network access is restricted.
- [ ] Required indexes exist and unique-index conflicts are resolved.
- [ ] Backup and restore procedures are tested.

## Security

- [ ] Independent strong JWT secrets are configured.
- [ ] Refresh cookie uses HTTPS in production.
- [ ] Organization scoping has been reviewed for all tenant-owned queries.
- [ ] Role and platform-admin middleware are correct.
- [ ] Upload type, size and ownership checks have been reviewed.
- [ ] Shared rate-limit storage is configured if multiple instances are used.

## Operations

- [ ] Process supervisor forwards SIGTERM/SIGINT.
- [ ] Termination grace period exceeds application shutdown timeout.
- [ ] Liveness/readiness probes are configured correctly.
- [ ] Logs are collected and retained securely.
- [ ] Alerts exist for readiness failure and elevated 5xx/latency.
- [ ] SMTP and storage integration configuration has been verified.

## Release governance

- [ ] Changelog reflects the release.
- [ ] API and module documentation match the code.
- [ ] Duplicate dashboard route registrations have been resolved or explicitly accepted.
- [ ] License metadata mismatch has been resolved with the owner.
