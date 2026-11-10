# Coverage

## Command

```bash
npm run test:coverage
```

The script uses Node's experimental test coverage instrumentation:

```bash
node --experimental-test-coverage --test "test/**/*.test.js"
```

## Last reported baseline

The project owner previously reported:
- Lines: **97.10%**
- Branches: **91.92%**
- Functions: **96.53%**

This is a recorded baseline from an earlier run, not a freshly measured result from the uploaded archive.

## How to interpret coverage

- **Line coverage** indicates whether executable lines ran.
- **Branch coverage** indicates whether conditional paths were exercised.
- **Function coverage** indicates whether functions were invoked.

High coverage does not prove correctness. Prioritize meaningful assertions for authorization, tenant isolation, state transitions, failure handling, concurrency and transaction rollback.

## Practical target

Do not add tests solely to force every line to 100%. Add tests where an untested branch represents a meaningful behavior or risk. Re-run coverage after meaningful changes and compare the report rather than relying on a stale percentage.
