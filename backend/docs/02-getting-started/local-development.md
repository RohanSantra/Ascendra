# Local development

## Start the API

```bash
npm run dev
```

The `dev` script runs `nodemon src/server.js`. The server connects to MongoDB before listening for HTTP requests.

## Common workflow

1. Create a focused branch for your change.
2. Read the relevant module documentation and source files.
3. Make the smallest cohesive change.
4. Add or update unit/integration tests.
5. Run the targeted test file while iterating.
6. Run `npm run check` before committing.
7. Update documentation when behavior, data contracts, routes, or operations change.

## Useful commands

```bash
npm run lint
npm test
npm run test:coverage
npm run check
```

`npm run check` runs linting first and then the test suite. `npm run test:watch` is available for iterative work; verify its glob behavior in your shell if it does not discover the expected files.

## API base URL

With default configuration:

```text
http://localhost:5000/api/v1
```

The host, port, and version prefix can change through environment configuration.

## Organization-scoped requests

For protected organization routes, include both:

```http
Authorization: Bearer <access-token>
X-Organization-Id: <organization-object-id>
```

Not every authenticated route requires an organization header. The route's middleware chain determines whether `loadOrganizationMembership` is applied.

## Shutdown

Use Ctrl+C in the terminal. `src/server.js` handles `SIGINT` and `SIGTERM`, stops accepting requests, closes MongoDB, and enforces a 10-second shutdown timeout.
