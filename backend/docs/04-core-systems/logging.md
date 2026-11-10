# Logging

## Logger API

Use the shared logger from `src/core/utils/logger.js`:

```js
import { logger } from "../../core/utils/logger.js";

logger.info("Operation completed", { requestId });
logger.warn("Unexpected state", { resourceId });
logger.error("Operation failed", { errorName: error.name });
```

Available levels are `info`, `warn`, and `error`.

## Environment-specific format

- Development: readable multi-line output with a separator, severity, message, IST timestamp, selected metadata labels, and optional stack trace.
- Production: one JSON object per log line, suitable for log aggregation.

Timestamps are formatted through `formatTimestamp()` in `src/core/utils/timeFormat.js` using `Asia/Kolkata`.

## Request correlation

The request ID middleware places `req.requestId` on the request and returns `X-Request-ID`. Error logs include the request ID, method, path, status and error metadata where available.

## Sensitive data

Never log passwords, access/refresh tokens, invitation tokens, reset tokens, SMTP credentials, Cloudinary secrets, full request bodies, or other secrets. Log identifiers and safe metadata only.

## Operational limitation

The logger writes to the process console. The repository does not configure a hosted log aggregator, retention policy, alerting platform, or distributed tracing provider. Those are deployment responsibilities.
