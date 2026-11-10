import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const createEnvironment = (overrides = {}) => {
    const environment = {
        ...process.env,
        CLIENT_URL: "https://client.example.com",
        MONGODB_URI: "mongodb://127.0.0.1:27017/test",
        JWT_ACCESS_SECRET: "test-access-secret",
        JWT_REFRESH_SECRET: "test-refresh-secret",
        ...overrides
    };

    return environment;
};

const loadEnvironment = (overrides = {}) =>
    spawnSync(
        process.execPath,
        [
            "--input-type=module",
            "--eval",
            "import env from './src/config/env.js'; console.log(JSON.stringify({ port: env.app.port, nodeEnv: env.nodeEnv, clientUrl: env.client.url, databaseUri: env.database.uri }));"
        ],
        {
            cwd: process.cwd(),
            env: createEnvironment(overrides),
            encoding: "utf8"
        }
    );

test("loads required values and uses defaults for optional environment variables", () => {
    const result = loadEnvironment();

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout.trim()), {
        port: 5000,
        nodeEnv: "development",
        clientUrl: "https://client.example.com",
        databaseUri: "mongodb://127.0.0.1:27017/test"
    });
});

test("rejects missing required environment variables", () => {
    const result = loadEnvironment({
        JWT_REFRESH_SECRET: ""
    });

    assert.notEqual(result.status, 0);
    assert.match(
        result.stderr,
        /Missing required environment variable: JWT_REFRESH_SECRET/
    );
});

test("rejects invalid numeric environment variables", () => {
    const result = loadEnvironment({
        PORT: "0"
    });

    assert.notEqual(result.status, 0);
    assert.match(
        result.stderr,
        /Environment variable PORT must be a positive integer/
    );
});
