import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-server";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-server";

const [{ default: app }, runtime] = await Promise.all([
    import("../../../src/app.js"),
    import("../../../src/core/runtime/appstate.js")
]);

test("connects to MongoDB before listening and gracefully shuts down on SIGINT", async (t) => {
    const originalSignalListeners = new Map(
        ["SIGINT", "SIGTERM", "unhandledRejection", "uncaughtException"]
            .map((event) => [event, new Set(process.listeners(event))])
    );
    const server = new EventEmitter();
    server.listening = true;
    server.close = (callback) => callback();

    let databaseConnectCalled = false;
    let listenCalled = false;
    let exitCode;
    let resolveExit;
    const exitCalled = new Promise((resolve) => {
        resolveExit = resolve;
    });

    t.mock.method(mongoose, "connect", async (uri, options) => {
        databaseConnectCalled = true;
        assert.equal(uri, process.env.MONGODB_URI);
        assert.deepEqual(options, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
            socketTimeoutMS: 45000
        });
        return mongoose;
    });
    t.mock.method(app, "listen", (...args) => {
        listenCalled = true;
        assert.equal(databaseConnectCalled, true);
        assert.equal(typeof args[1], "function");
        return server;
    });
    t.mock.method(process, "exit", (code) => {
        exitCode = code;
        resolveExit(code);
    });

    await import("../../../src/server.js");
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(databaseConnectCalled, true);
    assert.equal(listenCalled, true);

    const sigintHandler = process.listeners("SIGINT").find(
        (listener) => !originalSignalListeners.get("SIGINT").has(listener)
    );
    assert.equal(typeof sigintHandler, "function");

    sigintHandler();
    assert.equal(await exitCalled, 0);
    assert.equal(exitCode, 0);
    assert.equal(runtime.isApplicationShuttingDown(), true);

    for (const [event, originalListeners] of originalSignalListeners) {
        for (const listener of process.listeners(event)) {
            if (!originalListeners.has(listener)) {
                process.removeListener(event, listener);
            }
        }
    }
});

test("exits with a startup error when MongoDB cannot be reached", () => {
    const result = spawnSync(
        process.execPath,
        ["src/server.js"],
        {
            cwd: process.cwd(),
            env: {
                ...process.env,
                CLIENT_URL: "http://localhost:3000",
                MONGODB_URI: "mongodb://127.0.0.1:1/ascendra_test",
                JWT_ACCESS_SECRET: "server-startup-test-access-secret",
                JWT_REFRESH_SECRET: "server-startup-test-refresh-secret"
            },
            encoding: "utf8",
            timeout: 15_000
        }
    );

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /Application startup failed/);
});
