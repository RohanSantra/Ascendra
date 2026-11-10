
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const runLogger = (nodeEnv) => {
    const script = `
        const output = [];

        console.log = (value) => output.push({ method: "log", value });
        console.warn = (value) => output.push({ method: "warn", value });
        console.error = (value) => output.push({ method: "error", value });

        const { logger } = await import("./src/core/utils/logger.js");

        logger.info("Information message", {
            requestId: "request-123",
            method: "GET",
            path: "/api/test",
            statusCode: 200
        });

        logger.warn("Warning message", {
            errorCode: "WARNING_CODE"
        });

        logger.error("Error message", {
            errorName: "ValidationError",
            errorMessage: "Invalid input",
            stack: "Error: Invalid input\\\\n    at test.js:1:1"
        });

        process.stdout.write(JSON.stringify(output));
    `;

    const result = execFileSync(
        process.execPath,
        ["--input-type=module", "-e", script],
        {
            cwd: process.cwd(),
            env: {
                ...process.env,
                NODE_ENV: nodeEnv
            },
            encoding: "utf8"
        }
    );

    return JSON.parse(result);
};

test("formats development logs with readable output", () => {
    const output = runLogger("development");

    assert.equal(output.length, 3);

    assert.deepEqual(
        output.map((entry) => entry.method),
        ["log", "warn", "error"]
    );

    const infoLog = output[0].value;

    assert.match(infoLog, /\[INFO\] Information message/);
    assert.match(infoLog, /Request ID\s*: request-123/);
    assert.match(infoLog, /Method\s*: GET/);
    assert.match(infoLog, /Path\s*: \/api\/test/);
    assert.match(infoLog, /Status\s*: 200/);

    const warningLog = output[1].value;

    assert.match(warningLog, /\[WARN\] Warning message/);
    assert.match(warningLog, /Error Code\s*: WARNING_CODE/);

    const errorLog = output[2].value;

    assert.match(errorLog, /\[ERROR\] Error message/);
    assert.match(errorLog, /Error Type\s*: ValidationError/);
    assert.match(errorLog, /Error Message\s*: Invalid input/);
    assert.match(errorLog, /Stack Trace:/);
    assert.match(errorLog, /at test\.js:1:1/);
});

test("formats production logs as structured JSON", () => {
    const output = runLogger("production");

    assert.equal(output.length, 3);

    assert.deepEqual(
        output.map((entry) => entry.method),
        ["log", "warn", "error"]
    );

    const infoLog = JSON.parse(output[0].value);

    assert.equal(infoLog.level, "INFO");
    assert.equal(infoLog.message, "Information message");
    assert.equal(infoLog.requestId, "request-123");
    assert.equal(infoLog.method, "GET");
    assert.equal(infoLog.path, "/api/test");
    assert.equal(infoLog.statusCode, 200);
    assert.ok(infoLog.timestamp);

    const warningLog = JSON.parse(output[1].value);

    assert.equal(warningLog.level, "WARN");
    assert.equal(warningLog.message, "Warning message");
    assert.equal(warningLog.errorCode, "WARNING_CODE");

    const errorLog = JSON.parse(output[2].value);

    assert.equal(errorLog.level, "ERROR");
    assert.equal(errorLog.message, "Error message");
    assert.equal(errorLog.errorName, "ValidationError");
    assert.equal(errorLog.errorMessage, "Invalid input");
    assert.match(errorLog.stack, /at test\.js:1:1/);
});
