# Writing new tests

## Before writing

1. Find the module's existing tests.
2. Read the implementation and identify observable contracts.
3. Reuse existing fixtures, query stubs and database helpers.
4. Decide whether the behavior needs a unit or integration test.

## Minimum test matrix

For a typical service operation, consider:

| Case | Example |
|---|---|
| Success | Valid input and authorized actor |
| Validation | Missing or malformed input |
| Not found | Referenced resource does not exist |
| Conflict | Unique constraint or invalid lifecycle state |
| Authorization | Wrong role or membership status |
| Tenant isolation | Resource belongs to another organization |
| Transaction | A failed second write rolls back the first |
| Side effect | Email/storage operation is called only under intended conditions |

## Naming

Use a descriptive sentence for each test name. Keep tests grouped under the feature path in `test/unit/` or `test/integration/`.

## Run tests

Run one file while iterating:

```bash
node --test test/unit/path/to/your.test.js
```

Then run the complete checks:

```bash
npm run check
npm run test:coverage
```

Replace the example path with an actual test file.

## Documentation

If a new endpoint or workflow is added, update the module documentation, API reference, OpenAPI specification, and any relevant security or database documents.
