# Logging and monitoring

## Application logs

Use `logger.info`, `logger.warn` and `logger.error` from `src/core/utils/logger.js`.

- Development logs are human-readable and multi-line.
- Production logs are JSON lines.
- Timestamps are formatted in IST.
- Request IDs allow correlation between client responses and server logs.

## Health monitoring

Monitor:
- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`

Readiness currently checks shutdown state and MongoDB connectivity only.

## Metrics and alerting

The repository does not include a metrics exporter, tracing SDK, log shipping agent, alert manager or hosted monitoring configuration. Add these at the infrastructure/application boundary when required; do not assume they exist.

## Suggested operational signals

- Process restarts and startup failures.
- Readiness failures and MongoDB connection events.
- HTTP 5xx rate and latency.
- Rate-limit responses.
- Request timeout errors.
- Authentication failures and unusual session revocations.
- SMTP delivery failures.
- Course-material upload/access failures.
- Transaction failures and duplicate-key conflicts.

## Sensitive logging

Do not log passwords, tokens, invitation/reset URLs, SMTP credentials, Cloudinary secrets, or complete request bodies.
