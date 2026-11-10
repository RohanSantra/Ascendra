# Core systems

Core systems are shared infrastructure used by multiple feature modules. Read these documents before introducing a new cross-cutting pattern.

- [Configuration](configuration.md)
- [Error handling](error-handling.md)
- [Logging](logging.md)
- [Validation](validation.md)
- [Middleware](middleware.md)
- [Routing](routing.md)
- [API responses](api-responses.md)
- [Security](security.md)

## Shared implementation locations

| Concern | Main implementation |
|---|---|
| Environment | `src/config/env.js` |
| MongoDB lifecycle | `src/config/db.js` |
| Controlled errors | `src/core/errors/AppError.js` |
| Error/status constants | `src/core/constants/` |
| Success responses | `src/core/responses/ApiResponse.js` |
| Async controller wrapper | `src/core/utils/asyncHandler.js` |
| Logger | `src/core/utils/logger.js` |
| Organization reference checks | `src/core/utils/organizationReferences.js` |
| Retry utility | `src/core/utils/retry.js` |
| Timestamp formatting | `src/core/utils/timeFormat.js` |
| Request validation | `src/middleware/validate.middleware.js` |
| Error middleware | `src/middleware/error.middleware.js` |
