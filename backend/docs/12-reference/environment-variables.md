# Environment variables

This table is verified against `.env.example` and `src/config/env.js`.

| Variable | Required at server startup | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Production logger/cookie behavior |
| `APP_NAME` | No | `ASCENDRA` | Token issuer and startup log name |
| `API_VERSION` | No | `v1` | Mounted under `/api/` |
| `PORT` | No | `5000` | Positive safe integer |
| `CLIENT_URL` | Yes | None | CORS allowed origin |
| `MONGODB_URI` | Yes | None | MongoDB connection string |
| `JWT_ACCESS_SECRET` | Yes | None | Access JWT secret |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_SECRET` | Yes | None | Refresh JWT secret |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `JWT_REFRESH_COOKIE_NAME` | No | `refreshToken` | Refresh cookie name |
| `JWT_REFRESH_COOKIE_MAX_AGE` | No | `604800000` | Milliseconds; positive safe integer |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Positive safe integer |
| `SMTP_HOST` | No | empty | Email transport host |
| `SMTP_PORT` | No | `587` | Positive safe integer |
| `SMTP_SECURE` | No | `false` | True only when value lowercases to `true` |
| `SMTP_USER` | No | empty | SMTP authentication user |
| `SMTP_PASSWORD` | No | empty | SMTP authentication password |
| `EMAIL_FROM` | No | empty | Sender address |
| `INITIAL_ORG_NAME` | No | `Ascendra` | Bootstrap only |
| `INITIAL_ORG_SLUG` | No | `ascendra` | Bootstrap only |
| `INITIAL_ADMIN_FIRST_NAME` | No | empty | Bootstrap only |
| `INITIAL_ADMIN_LAST_NAME` | No | empty | Bootstrap only |
| `INITIAL_ADMIN_EMAIL` | No | empty | Bootstrap only |
| `INITIAL_ADMIN_PASSWORD` | No | empty | Bootstrap only; minimum 12 characters |
| `CLOUDINARY_CLOUD_NAME` | No | empty | Storage integration |
| `CLOUDINARY_API_KEY` | No | empty | Storage integration |
| `CLOUDINARY_API_SECRET` | No | empty | Storage integration |

## Validation behavior

- Required variables must be present and non-empty.
- Optional strings use their configured defaults when empty.
- Numeric values must parse as positive safe integers.
- `SMTP_SECURE` is parsed as a boolean by string comparison.
- Bootstrap values are validated more strictly when `npm run bootstrap` executes.

## Security

Never commit a populated `.env`. Use deployment secret management for production. The `.env.example` file must contain placeholders, never usable credentials.
