import test from "node:test";
import assert from "node:assert/strict";

import AppError from "../../../../src/core/errors/AppError.js";
import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../src/core/constants/index.js";

test("creates an operational application error with default values", () => {
    const error = new AppError("Something failed");

    assert.equal(error.name, "AppError");
    assert.equal(error.message, "Something failed");
    assert.equal(error.statusCode, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    assert.equal(error.code, ERROR_CODES.INTERNAL_SERVER_ERROR);
    assert.equal(error.details, null);
    assert.equal(error.isOperational, true);
});

test("preserves error code, details and cause", () => {
    const cause = new Error("Database failure");
    const details = [{ field: "email", message: "Invalid email" }];
    const error = new AppError(
        "Validation failed",
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        details,
        cause
    );

    assert.equal(error.statusCode, 422);
    assert.equal(error.code, ERROR_CODES.VALIDATION_ERROR);
    assert.equal(error.details, details);
    assert.equal(error.cause, cause);
});

test("rejects status codes outside the client and server error range", () => {
    for (const statusCode of [200, 399, 600, 400.5]) {
        assert.throws(
            () => new AppError("Invalid status", statusCode),
            {
                name: "TypeError",
                message: "AppError statusCode must be an integer between 400 and 599."
            }
        );
    }
});
