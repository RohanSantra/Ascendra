# Deployment overview

## Deployment shape

The repository provides a Node.js HTTP API and MongoDB connection lifecycle. It does not prescribe a cloud provider, container platform, reverse proxy, CI/CD system, or process supervisor. Choose and document those as deployment decisions for the target environment.

## Runtime requirements

- Node.js `>=20.19.0`.
- Install production dependencies from the lockfile.
- Provide required environment variables.
- Provide reachable MongoDB.
- Use a replica set/compatible cluster for transaction-backed workflows.
- Configure SMTP and Cloudinary only when those integrations are enabled.

## Start command

```bash
npm start
```

This runs `node src/server.js`. The server connects to MongoDB before accepting traffic.

## Operational endpoints

- `GET /api/v1/health/live`: process liveness.
- `GET /api/v1/health/ready`: readiness based on shutdown state and MongoDB connectivity.

Use the configured API version prefix if it differs from `v1`.

## Deployment responsibilities not implemented by the repository

The deployment environment must supply TLS termination, secret storage, network restrictions, process supervision, shared rate-limit storage for multi-instance deployments, log aggregation, alerting, backups and disaster recovery as required.

## Release sequence

1. Review changes and changelog.
2. Run lint, unit and integration tests.
3. Review environment variables and secret configuration.
4. Confirm database compatibility and index rollout.
5. Run bootstrap only for a new database.
6. Deploy the server.
7. Verify readiness and inspect startup logs.
8. Monitor error rate, latency, database connectivity and external integrations.
