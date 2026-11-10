import test from "node:test";
import assert from "node:assert/strict";

import AppError from "../../../src/core/errors/AppError.js";
import createRequestTimeout from "../../../src/middleware/requestTimeout.middleware.js";

const createResponse = (headersSent = false) => {
    const listeners = new Map();

    return {
        headersSent,
        listeners,
        on(event, listener) {
            listeners.set(event, listener);
            return this;
        }
    };
};

test("rejects non-positive and non-integer request timeouts", () => {
    for (const timeout of [0, -1, 1.5, "100"]) {
        assert.throws(
            () => createRequestTimeout(timeout),
            {
                name: "TypeError",
                message: "Request timeout must be a positive integer"
            }
        );
    }
});

test("starts a request timeout and forwards a controlled timeout error", async () => {
    const middleware = createRequestTimeout(10);
    const request = {};
    const response = createResponse();
    let nextCalls = 0;
    let nextError;

    middleware(request, response, (error) => {
        nextCalls += 1;
        nextError = error;
    });

    assert.equal(nextCalls, 1);
    assert.equal(request.requestTimedOut(), false);
    assert.equal(typeof response.listeners.get("finish"), "function");
    assert.equal(typeof response.listeners.get("close"), "function");

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(nextCalls, 2);
    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 408);
    assert.equal(nextError.code, "REQUEST_TIMEOUT");
    assert.equal(request.requestTimedOut(), true);
});

test("does not forward a timeout after response headers were sent", async () => {
    const middleware = createRequestTimeout(5);
    const request = {};
    const response = createResponse(true);
    let nextCalls = 0;

    middleware(request, response, () => {
        nextCalls += 1;
    });

    await new Promise((resolve) => setTimeout(resolve, 15));

    assert.equal(nextCalls, 1);
    assert.equal(request.requestTimedOut(), false);
});

test("clears the timeout when the response finishes", async () => {
    const middleware = createRequestTimeout(10);
    const request = {};
    const response = createResponse();
    let nextCalls = 0;

    middleware(request, response, () => {
        nextCalls += 1;
    });
    response.listeners.get("finish")();

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(nextCalls, 1);
    assert.equal(request.requestTimedOut(), false);
});
