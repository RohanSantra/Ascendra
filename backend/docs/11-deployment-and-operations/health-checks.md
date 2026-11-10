# Health checks

The health router is mounted at `/api/{API_VERSION}/health`.

## Liveness

`GET /api/v1/health/live`

Returns a success response indicating that the process can answer HTTP requests. It intentionally does not check MongoDB or optional infrastructure. A liveness failure can be used by an orchestrator to decide whether a process is stuck/unavailable.

## Readiness

`GET /api/v1/health/ready`

Readiness checks:
- Whether the application is shutting down.
- Whether Mongoose reports the database as connected.

If shutting down or MongoDB is unavailable, the endpoint returns HTTP 503 with `SERVICE_UNAVAILABLE` and dependency details. Otherwise it returns a success response with database availability.

## Not included

The current readiness controller does not check SMTP, Cloudinary, Redis, a queue, or other optional infrastructure. Its source contains comments describing how optional checks could be added later, but those checks are not active.

## Deployment usage

Use liveness and readiness for different purposes. Do not use liveness as a database health check. Configure load balancers/orchestrators against the readiness endpoint for traffic eligibility.
