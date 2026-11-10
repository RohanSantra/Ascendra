import test, {
    after,
    before
} from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-app-integration";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-app-integration";

const { default: app } = await import("../../../src/app.js");
const { markShuttingDown } = await import(
    "../../../src/core/runtime/appstate.js"
);

let server;
let baseUrl;

before(async () => {
    server = app.listen(0);
    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
});

test("serves liveness with security and request correlation headers", async () => {
    const requestId = "8f0a3f6b-1e7a-4f3d-9e0a-1b2c3d4e5f60";
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
        headers: {
            "X-Request-ID": requestId,
            Origin: "http://localhost:3000"
        }
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-request-id"), requestId);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal(
        response.headers.get("access-control-allow-origin"),
        "http://localhost:3000"
    );
    assert.deepEqual(body.data, { status: "alive" });
    assert.equal(body.requestId, requestId);
});

test("returns a not-ready response while MongoDB is disconnected", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.message, "Service is not ready");
    assert.deepEqual(body.error.details.dependencies, {
        database: "unavailable"
    });
});

test("reports readiness when MongoDB is connected", async (t) => {
    const originalReadyState = mongoose.connection.readyState;
    t.after(() => {
        mongoose.connection.readyState = originalReadyState;
    });
    mongoose.connection.readyState = 1;

    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.message, "Service is ready");
    assert.deepEqual(body.data, {
        status: "ready",
        dependencies: { database: "available" }
    });
});

test("returns a structured route-not-found response with a generated request ID", async () => {
    const response = await fetch(`${baseUrl}/api/v1/not-a-route`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "ROUTE_NOT_FOUND");
    assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/i);
    assert.equal(body.requestId, response.headers.get("x-request-id"));
});

test("normalizes malformed JSON request bodies", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: "{invalid-json"
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.message, "Malformed JSON request body");
    assert.equal(body.error.code, "INVALID_REQUEST");
});

test("rejects request bodies that exceed the configured size limit", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/live`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ value: "x".repeat(500 * 1024) })
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(body.message, "Request body exceeds the allowed size");
    assert.equal(body.error.code, "PAYLOAD_TOO_LARGE");
});

test("reports unavailable readiness during application shutdown", async () => {
    markShuttingDown();

    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.message, "Service is shutting down");
    assert.equal(body.error.code, "SERVICE_UNAVAILABLE");
});
