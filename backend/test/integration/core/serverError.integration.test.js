import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "server-error-test-access-secret";
process.env.JWT_REFRESH_SECRET ||= "server-error-test-refresh-secret";

const [{ default: app }, runtime] = await Promise.all([
    import("../../../src/app.js"),
    import("../../../src/core/runtime/appstate.js")
]);

test("shuts down with a failure exit code after an HTTP server error", async (t) => {
    const originalSignalListeners = new Map(
        ["SIGINT", "SIGTERM", "unhandledRejection", "uncaughtException"]
            .map((event) => [event, new Set(process.listeners(event))])
    );
    const server = new EventEmitter();
    server.listening = true;
    server.close = (callback) => callback();

    let exitCalls = 0;
    let resolveExit;
    const exited = new Promise((resolve) => {
        resolveExit = resolve;
    });

    t.mock.method(mongoose, "connect", async () => mongoose);
    t.mock.method(app, "listen", () => server);
    t.mock.method(process, "exit", (exitCode) => {
        exitCalls += 1;
        resolveExit(exitCode);
    });

    await import("../../../src/server.js");
    await new Promise((resolve) => setImmediate(resolve));

    server.emit("error", new Error("Simulated HTTP server error"));

    assert.equal(await exited, 1);
    assert.equal(runtime.isApplicationShuttingDown(), true);

    server.emit("error", new Error("Repeated HTTP server error"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(exitCalls, 1);

    for (const [event, originalListeners] of originalSignalListeners) {
        for (const listener of process.listeners(event)) {
            if (!originalListeners.has(listener)) {
                process.removeListener(event, listener);
            }
        }
    }
});
