# Dependencies

The following direct dependencies are declared in `package.json`. Transitive dependencies are managed by `package-lock.json`.

## Runtime dependencies

| Package | Declared version | Role in the application |
|---|---:|---|
| `bcryptjs` | `^3.0.3` | Password hashing and comparison |
| `cloudinary` | `^2.11.0` | Cloudinary storage integration |
| `compression` | `^1.8.2` | HTTP response compression |
| `cookie-parser` | `^1.4.7` | Parses refresh-token cookies |
| `cors` | `^2.8.6` | Cross-origin request policy |
| `dotenv` | `^18.0.5` | Loads environment variables |
| `express` | `^5.2.1` | HTTP application and routing |
| `express-rate-limit` | `^8.7.0` | Request rate limiting |
| `helmet` | `^8.3.0` | Security-related HTTP headers |
| `jsonwebtoken` | `^9.0.3` | JWT signing and verification |
| `mongoose` | `^9.10.3` | MongoDB object modeling and connection |
| `multer` | `^2.5.0` | Multipart upload middleware dependency |
| `nodemailer` | `^10.4.0` | SMTP email delivery |
| `zod` | `^4.6.5` | Runtime request validation |

## Development dependencies

| Package | Declared version | Role |
|---|---:|---|
| `@eslint/js` | `^10.0.1` | ESLint JavaScript recommended configuration |
| `eslint` | `^10.11.0` | Static linting |
| `globals` | `^17.13.0` | Global environment definitions for ESLint |
| `mongodb-memory-server` | `^11.3.0` | In-memory MongoDB replica set for tests |
| `nodemon` | `^3.1.14` | Development process restart |

## Dependency changes

Before adding a dependency:
1. Check whether Node.js or an existing package already provides the capability.
2. Confirm it is actively used and appropriate for the project.
3. Consider security, maintenance, bundle/runtime cost and license.
4. Update the lockfile.
5. Add tests and documentation where behavior changes.

This list is a snapshot of the uploaded `package.json`; the manifest and lockfile are authoritative.
