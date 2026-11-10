import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import mongoose from "mongoose";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../src/core/constants/index.js";

import AppError from "../../../src/core/errors/AppError.js";
import { logger } from "../../../src/core/utils/logger.js";
import errorHandler from "../../../src/middleware/error.middleware.js";
import notFoundHandler from "../../../src/middleware/notFound.middleware.js";
import requestId from "../../../src/middleware/requestId.middleware.js";
import validateRequest from "../../../src/middleware/validate.middleware.js";
import asyncHandler from "../../../src/core/utils/asyncHandler.js";

const createResponse = () => ({
    headersSent: false,
    statusCode: null,
    body: null,
    headers: {},
    status(statusCode) {
        this.statusCode = statusCode;
        return this;
    },
    json(body) {
        this.body = body;
        return this;
    },
    setHeader(name, value) {
        this.headers[name] = value;
    }
});

test("validates enabled request sections and stores parsed data", async () => {
    const middleware = validateRequest(
        z.object({
            body: z.object({ name: z.string().trim() }),
            params: z.object({ id: z.string() })
        }),
        { body: true, params: true }
    );
    const request = {
        body: { name: "  Trainer  " },
        params: { id: "user-1" }
    };
    let nextError;

    await middleware(request, {}, (error) => {
        nextError = error;
    });

    assert.equal(nextError, undefined);
    assert.deepEqual(request.validated, {
        body: { name: "Trainer" },
        params: { id: "user-1" }
    });
});

test("converts schema failures into validation application errors", async () => {
    const middleware = validateRequest(
        z.object({
            body: z.object({ email: z.string().email() })
        }),
        { body: true }
    );
    let nextError;

    await middleware({ body: { email: "invalid" } }, {}, (error) => {
        nextError = error;
    });

    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 422);
    assert.equal(nextError.code, "VALIDATION_ERROR");
    assert.equal(nextError.details[0].field, "body.email");
});

test("forwards non-schema validation errors unchanged", async () => {
    const middlewareError = new Error("Parser failed");
    const middleware = validateRequest(
        {
            parseAsync: async () => {
                throw middlewareError;
            }
        },
        { body: true }
    );
    let nextError;

    await middleware({ body: {} }, {}, (error) => {
        nextError = error;
    });

    assert.equal(nextError, middlewareError);
});

test("rejects invalid validation middleware configuration", () => {
    assert.throws(
        () => validateRequest({}, { body: true }),
        /schema must provide a parseAsync function/
    );
    assert.throws(
        () => validateRequest({ parseAsync() {} }),
        /At least one request section must be enabled/
    );
    assert.throws(
        () => validateRequest({ parseAsync() {} }, { body: "yes" }),
        /Validation options must be booleans/
    );
});

test("reuses a valid incoming request ID and replaces invalid IDs", () => {
    const suppliedId = "8f0a3f6b-1e7a-4f3d-9e0a-1b2c3d4e5f60";
    const validRequest = {
        get: () => ` ${suppliedId} `
    };
    const validResponse = createResponse();
    let nextCalls = 0;

    requestId(validRequest, validResponse, () => {
        nextCalls += 1;
    });

    assert.equal(validRequest.requestId, suppliedId);
    assert.equal(validResponse.headers["X-Request-ID"], suppliedId);
    assert.equal(nextCalls, 1);

    const invalidRequest = { get: () => "not-a-uuid" };
    const invalidResponse = createResponse();

    requestId(invalidRequest, invalidResponse, () => {});

    assert.match(
        invalidRequest.requestId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    assert.equal(
        invalidResponse.headers["X-Request-ID"],
        invalidRequest.requestId
    );
});

test("passes unmatched routes to the error middleware", () => {
    let nextError;

    notFoundHandler({}, {}, (error) => {
        nextError = error;
    });

    assert.ok(nextError instanceof AppError);
    assert.equal(nextError.statusCode, 404);
    assert.equal(nextError.code, "ROUTE_NOT_FOUND");
});

test("forwards rejected async handlers to Express error middleware", async () => {
    const failure = new Error("Handler failed");
    const wrapped = asyncHandler(async () => {
        throw failure;
    });

    await new Promise((resolve, reject) => {
        wrapped({}, {}, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    }).then(
        () => assert.fail("Expected the handler error to be forwarded"),
        (error) => assert.equal(error, failure)
    );
});

test("serializes operational errors and hides unexpected error details", (t) => {
    t.mock.method(logger, "error", () => {});
    const response = createResponse();
    const request = {
        requestId: "request-123",
        method: "GET",
        path: "/records"
    };

    errorHandler(
        new AppError("Record missing", 404, "RESOURCE_NOT_FOUND", {
            resource: "record"
        }),
        request,
        response,
        () => assert.fail("Operational errors should not be delegated")
    );

    assert.equal(response.statusCode, 404);
    assert.equal(response.body.message, "Record missing");
    assert.deepEqual(response.body.error.details, { resource: "record" });
    assert.equal(response.body.requestId, "request-123");

    const unexpectedResponse = createResponse();
    errorHandler(
        new Error("Internal database password"),
        request,
        unexpectedResponse,
        () => assert.fail("Unexpected errors should be serialized")
    );

    assert.equal(unexpectedResponse.statusCode, 500);
    assert.equal(unexpectedResponse.body.message, "Internal server error");
    assert.equal(
        unexpectedResponse.body.error.code,
        "INTERNAL_SERVER_ERROR"
    );
    assert.equal(unexpectedResponse.body.error.details, null);
});

test("normalizes Mongoose validation, casting and duplicate-key failures", (t) => {
    t.mock.method(logger, "error", () => {});

    const validationError = new mongoose.Error.ValidationError();
    validationError.addError(
        "email",
        new mongoose.Error.ValidatorError({
            path: "email",
            message: "Email is invalid"
        })
    );
    const validationResponse = createResponse();
    errorHandler(validationError, {}, validationResponse, () => {});

    assert.equal(validationResponse.statusCode, 422);
    assert.equal(validationResponse.body.error.code, "VALIDATION_ERROR");
    assert.deepEqual(validationResponse.body.error.details, [{
        field: "email",
        message: "Email is invalid"
    }]);

    const castError = new mongoose.Error.CastError(
        "ObjectId",
        "private-value",
        "userId"
    );
    const castResponse = createResponse();
    errorHandler(castError, {}, castResponse, () => {});

    assert.equal(castResponse.statusCode, 400);
    assert.equal(castResponse.body.error.code, "INVALID_PARAMETER");
    assert.deepEqual(castResponse.body.error.details, { field: "userId" });
    assert.equal(JSON.stringify(castResponse.body).includes("private-value"), false);

    const duplicateResponse = createResponse();
    errorHandler(
        { code: 11000, keyPattern: { email: 1 } },
        {},
        duplicateResponse,
        () => {}
    );

    assert.equal(duplicateResponse.statusCode, 409);
    assert.equal(
        duplicateResponse.body.error.code,
        "RESOURCE_ALREADY_EXISTS"
    );
    assert.deepEqual(duplicateResponse.body.error.details, {
        fields: ["email"]
    });
});

test("delegates errors when response headers have already been sent", () => {
    const error = new Error("Already sent");
    const response = { headersSent: true };
    let delegatedError;

    errorHandler(error, {}, response, (nextError) => {
        delegatedError = nextError;
    });

    assert.equal(delegatedError, error);
});


test("normalizes Mongoose validation errors", () => {
    const error = new mongoose.Error.ValidationError();

    error.addError(
        "name",
        new mongoose.Error.ValidatorError({
            message: "Name is required",
            path: "name"
        })
    );

    const req = {
        requestId: "test-request-id",
        method: "POST",
        path: "/test"
    };

    const res = createResponse();

    errorHandler(error, req, res, () => {});

    assert.equal(
        res.statusCode,
        HTTP_STATUS.UNPROCESSABLE_ENTITY
    );

    assert.equal(
        res.body.error.code,
        ERROR_CODES.VALIDATION_ERROR
    );

    assert.deepEqual(
        res.body.error.details,
        [
            {
                field: "name",
                message: "Name is required"
            }
        ]
    );
});

test("normalizes Mongoose casting errors without exposing submitted values", () => {
    const error = new mongoose.Error.CastError(
        "ObjectId",
        "sensitive-submitted-value",
        "userId"
    );

    const req = {
        requestId: "test-request-id",
        method: "GET",
        path: "/users"
    };

    const res = createResponse();

    errorHandler(error, req, res, () => {});

    assert.equal(
        res.statusCode,
        HTTP_STATUS.BAD_REQUEST
    );

    assert.equal(
        res.body.error.code,
        ERROR_CODES.INVALID_PARAMETER
    );

    assert.deepEqual(
        res.body.error.details,
        {
            field: "userId"
        }
    );

    assert.equal(
        JSON.stringify(res.body).includes("sensitive-submitted-value"),
        false
    );
});

test("normalizes MongoDB duplicate-key errors", () => {
    const error = new Error("Duplicate key");

    error.code = 11000;
    error.keyPattern = {
        email: 1,
        organizationId: 1
    };

    const req = {
        method: "POST",
        path: "/users"
    };

    const res = createResponse();

    errorHandler(error, req, res, () => {});

    assert.equal(
        res.statusCode,
        HTTP_STATUS.CONFLICT
    );

    assert.equal(
        res.body.error.code,
        ERROR_CODES.RESOURCE_ALREADY_EXISTS
    );

    assert.deepEqual(
        res.body.error.details,
        {
            fields: ["email", "organizationId"]
        }
    );
});

test("normalizes malformed JSON request errors", () => {
    const error = new Error("Unexpected token");

    error.type = "entity.parse.failed";

    const req = {
        method: "POST",
        path: "/users"
    };

    const res = createResponse();

    errorHandler(error, req, res, () => {});

    assert.equal(
        res.statusCode,
        HTTP_STATUS.BAD_REQUEST
    );

    assert.equal(
        res.body.error.code,
        ERROR_CODES.INVALID_REQUEST
    );

    assert.equal(
        res.body.message,
        "Malformed JSON request body"
    );

    assert.equal(res.body.error.details, null);
});

test("normalizes oversized request body errors", () => {
    const error = new Error("Payload too large");

    error.type = "entity.too.large";

    const req = {
        method: "POST",
        path: "/uploads"
    };

    const res = createResponse();

    errorHandler(error, req, res, () => {});

    assert.equal(
        res.statusCode,
        HTTP_STATUS.PAYLOAD_TOO_LARGE
    );

    assert.equal(
        res.body.error.code,
        ERROR_CODES.PAYLOAD_TOO_LARGE
    );

    assert.equal(
        res.body.message,
        "Request body exceeds the allowed size"
    );

    assert.equal(res.body.error.details, null);
});