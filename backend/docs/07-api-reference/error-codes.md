# Error codes

Application error codes are centralized in `src/core/constants/errorCodes.js`; HTTP status values are centralized in `src/core/constants/httpStatus.js`.

The error middleware may also produce codes when normalizing Mongoose, MongoDB, and body-parser errors.

## Response shape

```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "field": "body.email",
        "message": "Invalid email"
      }
    ]
  },
  "requestId": "00000000-0000-4000-8000-000000000000"
}
```

This is a representative validation response. Exact detail values depend on the failing schema.

## Error handling guidance

- Use the constants exported from `src/core/constants/index.js`.
- Treat the HTTP status as the transport-level classification and `error.code` as the application-level classification.
- Use `error.details` for structured, safe field/resource context.
- Do not build client logic around internal exception names or messages.
- Do not expect internal 5xx messages or stack traces in API responses.

For the authoritative list, read `src/core/constants/errorCodes.js`; this document intentionally does not maintain a separately copied enum that could drift.


## Shared error-code constants

The following codes are explicitly exported from `src/core/constants/errorCodes.js`. Feature modules may also define domain-specific codes locally; inspect the relevant service/controller for those.

### General
`VALIDATION_ERROR`, `INVALID_REQUEST`, `INVALID_PARAMETER`, `ROUTE_NOT_FOUND`, `RESOURCE_NOT_FOUND`, `RESOURCE_ALREADY_EXISTS`, `RESOURCE_CONFLICT`, `INTERNAL_SERVER_ERROR`, `SERVICE_UNAVAILABLE`.

### Database
`DATABASE_ERROR`, `DATABASE_CONNECTION_FAILED`, `DATABASE_TIMEOUT`.

### Rate limiting
`RATE_LIMIT_EXCEEDED`.

### External services
`EXTERNAL_SERVICE_ERROR`, `EXTERNAL_SERVICE_TIMEOUT`.

### Request processing
`REQUEST_TIMEOUT`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`.

### Authentication
`AUTH_REQUIRED`, `INVALID_ACCESS_TOKEN`, `ACCESS_TOKEN_EXPIRED`, `INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `INVALID_PASSWORD_RESET_TOKEN`, `INVALID_CREDENTIALS`, `ACCOUNT_SUSPENDED`, `SESSION_EXPIRED`, `SESSION_REVOKED`, `PASSWORD_MISMATCH`.

### Authorization
`INSUFFICIENT_PERMISSIONS`, `RESOURCE_ACCESS_DENIED`.

### Users
`USER_NOT_FOUND`, `USER_EMAIL_ALREADY_EXISTS`.

### Files
`FILE_TOO_LARGE`, `INVALID_FILE_TYPE`, `FILE_NOT_FOUND`, `FILE_UPLOAD_FAILED`.
