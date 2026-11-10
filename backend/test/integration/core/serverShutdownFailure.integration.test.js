import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "server-shutdown-test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "server-shutdown-test-refresh-secret";

const [{ default: app }, { logger }] = await Promise.all([
    import("../../../src/app.js"),
    import("../../../src/core/utils/logger.js")
]);

test("logs and exits when graceful HTTP shutdown fails", async (t) => {
    const originalSignalListeners = new Map(
        ["SIGINT", "SIGTERM", "unhandledRejection", "uncaughtException"]
            .map((event) => [event, new Set(process.listeners(event))])
    );
    const server = new EventEmitter();
    server.listening = true;
    server.close = (callback) =>
        callback(new Error("Simulated HTTP close failure"));

    const logCalls = [];
    let resolveExit;
    const exited = new Promise((resolve) => {
        resolveExit = resolve;
    });

    t.mock.method(mongoose, "connect", async () => mongoose);
    t.mock.method(app, "listen", () => server);
    t.mock.method(logger, "error", (...args) => {
        logCalls.push(args);
    });
    t.mock.method(process, "exit", (exitCode) => {
        resolveExit(exitCode);
    });

    await import("../../../src/server.js");
    await new Promise((resolve) => setImmediate(resolve));
    server.emit("error", new Error("Simulated server failure"));

    assert.equal(await exited, 1);
    assert.ok(
        logCalls.some(
            ([message]) => message === "Graceful shutdown failed"
        )
    );

    for (const [event, originalListeners] of originalSignalListeners) {
        for (const listener of process.listeners(event)) {
            if (!originalListeners.has(listener)) {
                process.removeListener(event, listener);
            }
        }
    }
});
