import test from "node:test";
import assert from "node:assert/strict";

import ApiResponse from "../../../../src/core/responses/ApiResponse.js";

const createResponse = (requestId = "request-123") => {
    const response = {
        statusCode: null,
        body: null,
        sent: false,
        req: { requestId },
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        send() {
            this.sent = true;
            return this;
        }
    };

    return response;
};

test("sends a standardized successful response with its request ID", () => {
    const response = createResponse();
    const data = { id: "resource-1" };
    const meta = { page: 1 };

    ApiResponse.send(response, {
        statusCode: 200,
        message: "Loaded",
        data,
        meta
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.body instanceof ApiResponse);
    assert.deepEqual({ ...response.body }, {
        success: true,
        statusCode: 200,
        message: "Loaded",
        data,
        meta,
        requestId: "request-123"
    });
});

test("uses null defaults when optional response values are omitted", () => {
    const response = createResponse(null);

    ApiResponse.ok(response, "Done");

    assert.equal(response.body.data, null);
    assert.equal(response.body.meta, null);
    assert.equal(response.body.requestId, null);
});

test("sends created and accepted responses with their standard status codes", () => {
    const createdResponse = createResponse();
    const acceptedResponse = createResponse();

    ApiResponse.created(createdResponse, "Created", { id: "created-1" });
    ApiResponse.accepted(acceptedResponse, "Accepted", { id: "queued-1" });

    assert.equal(createdResponse.statusCode, 201);
    assert.equal(createdResponse.body.message, "Created");
    assert.deepEqual(createdResponse.body.data, { id: "created-1" });
    assert.equal(acceptedResponse.statusCode, 202);
    assert.equal(acceptedResponse.body.message, "Accepted");
    assert.deepEqual(acceptedResponse.body.data, { id: "queued-1" });
});

test("sends a no-content response without a body", () => {
    const response = createResponse();

    assert.equal(ApiResponse.noContent(response), response);
    assert.equal(response.statusCode, 204);
    assert.equal(response.sent, true);
    assert.equal(response.body, null);
});

test("rejects unsuccessful and no-content statuses from the JSON response sender", () => {
    for (const statusCode of [199, 300, 204, 200.5]) {
        assert.throws(
            () => ApiResponse.send(createResponse(), {
                statusCode,
                message: "Invalid"
            }),
            {
                name: "TypeError",
                message: "ApiResponse.send requires a successful HTTP status code other than 204."
            }
        );
    }
});
