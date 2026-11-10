import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "server-failure-test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "server-failure-test-refresh-secret";

const [{ default: app }, { logger }] = await Promise.all([
    import("../../../src/app.js"),
    import("../../../src/core/utils/logger.js")
]);

test("logs and exits when the initial database connection fails", async (t) => {
    const originalSignalListeners = new Map(
        ["SIGINT", "SIGTERM", "unhandledRejection", "uncaughtException"]
            .map((event) => [event, new Set(process.listeners(event))])
    );
    const logCalls = [];
    let listenCalled = false;
    let resolveExit;
    const exited = new Promise((resolve) => {
        resolveExit = resolve;
    });

    t.mock.method(mongoose, "connect", async () => {
        throw new Error("Simulated database connection failure");
    });
    t.mock.method(app, "listen", () => {
        listenCalled = true;
        throw new Error("Server must not listen without a database");
    });
    t.mock.method(logger, "error", (...args) => {
        logCalls.push(args);
    });
    t.mock.method(process, "exit", (exitCode) => {
        resolveExit(exitCode);
    });

    await import("../../../src/server.js");

    assert.equal(await exited, 1);
    assert.equal(listenCalled, false);
    assert.equal(logCalls[0][0], "Application startup failed");
    assert.equal(
        logCalls[0][1].errorMessage,
        "Simulated database connection failure"
    );

    for (const [event, originalListeners] of originalSignalListeners) {
        for (const listener of process.listeners(event)) {
            if (!originalListeners.has(listener)) {
                process.removeListener(event, listener);
            }
        }
    }
});
