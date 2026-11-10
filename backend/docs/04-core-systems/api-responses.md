# API responses

## Successful responses

`ApiResponse` in `src/core/responses/ApiResponse.js` standardizes success envelopes.

Typical shape:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Human-readable message",
  "data": {},
  "meta": null,
  "requestId": "00000000-0000-4000-8000-000000000000"
}
```

The example illustrates the envelope only; the actual `data` and `meta` depend on the endpoint.

Available helpers:
- `ApiResponse.send(res, options)`
- `ApiResponse.ok(res, message, data, meta)`
- `ApiResponse.created(res, message, data, meta)`
- `ApiResponse.accepted(res, message, data, meta)`
- `ApiResponse.noContent(res)`

`send` accepts successful HTTP status codes from 200 through 299 except 204. Use `noContent` for 204 because a 204 response must not include a body.

## Error responses

The global error middleware returns:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Human-readable error message",
  "error": {
    "code": "APPLICATION_ERROR_CODE",
    "details": null
  },
  "requestId": "00000000-0000-4000-8000-000000000000"
}
```

For internal failures, the message and code are generic and details are hidden. The request ID may be `null` if the middleware has not assigned one (for example, an error outside the normal request pipeline).

## Pagination

Some list endpoints use metadata for pagination. The exact metadata keys and calculation are endpoint-specific; consult the controller/service rather than assuming one universal pagination contract.

## Developer rules

Use the shared response helper in controllers. Do not manually build success envelopes with a different shape. Keep errors flowing through `AppError` and the centralized error middleware.
