# npm scripts

Scripts are defined in `package.json`.

| Script | Command | Description |
|---|---|---|
| `dev` | `nodemon src/server.js` | Development server with restart on file changes |
| `start` | `node src/server.js` | Production-style server start |
| `lint` | `eslint .` | Lint repository |
| `lint:fix` | `eslint . --fix` | Apply automatic lint fixes |
| `bootstrap` | `node scripts/bootstrap.js` | Create initial platform admin, organization and admin membership |
| `test` | `node --test "test/**/*.test.js"` | Run discovered test files |
| `test:watch` | `node --test --watch "test/**/*.test.js"` | Watch test files |
| `test:coverage` | `node --experimental-test-coverage --test "test/**/*.test.js"` | Run tests with coverage instrumentation |
| `check` | `npm run lint && npm test` | Lint, then run tests |

Run commands from the repository root. If a shell behaves differently when expanding the test glob, verify test discovery from the output rather than assuming all files ran.
