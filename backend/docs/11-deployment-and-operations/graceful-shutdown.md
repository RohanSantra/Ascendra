# Graceful shutdown

## Implementation

`src/server.js` owns the HTTP server reference and shutdown process. It handles:
- `SIGINT`
- `SIGTERM`
- HTTP server `error`
- `unhandledRejection`
- `uncaughtException`

## Sequence

1. `isApplicationShuttingDown()` prevents a duplicate shutdown.
2. `markShuttingDown()` marks runtime state.
3. A 10-second timeout is started.
4. If the HTTP server is listening, `server.close()` stops accepting new connections and waits for the close callback.
5. `disconnectDatabase()` closes MongoDB.
6. The process exits with the selected code.

If shutdown exceeds the timeout or cleanup fails, the process exits with code 1.

## Operational guidance

- Ensure the process manager sends SIGTERM and allows at least the configured shutdown window.
- Set container/orchestrator termination grace period longer than the application's 10-second timeout.
- Do not bypass the shutdown handler with immediate process termination during normal deploys.
- Test shutdown behavior after changes to server lifecycle or database connection code.
