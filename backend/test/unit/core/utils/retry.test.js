
import test from "node:test";
import assert from "node:assert/strict";

import {
    retry,
    isRetryableError
} from "../../../../src/core/utils/retry.js";


const createError = (properties = {}) => {
    return Object.assign(
        new Error("Test failure"),
        properties
    );
};


test("identifies retryable network errors", () => {
    for (const code of [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED"
    ]) {
        assert.equal(
            isRetryableError(createError({ code })),
            true
        );
    }
});


test("identifies retryable HTTP status codes", () => {
    for (const statusCode of [
        408,
        429,
        500,
        502,
        503,
        599
    ]) {
        assert.equal(
            isRetryableError(createError({ statusCode })),
            true
        );
    }
});


test("rejects non-retryable HTTP status codes", () => {
    for (const statusCode of [
        400,
        401,
        403,
        404,
        499,
        600
    ]) {
        assert.equal(
            isRetryableError(createError({ statusCode })),
            false
        );
    }
});


test("rejects primitive and null errors", () => {
    for (const error of [
        null,
        undefined,
        "network error",
        500,
        true
    ]) {
        assert.equal(isRetryableError(error), false);
    }
});


test("returns the operation result without retrying", async () => {
    let calls = 0;

    const result = await retry(
        async () => {
            calls += 1;
            return "success";
        },
        { baseDelayMs: 0 }
    );

    assert.equal(result, "success");
    assert.equal(calls, 1);
});


test("retries a transient failure and returns the successful result", async () => {
    let calls = 0;

    const result = await retry(
        async () => {
            calls += 1;

            if (calls === 1) {
                throw createError({
                    code: "ECONNRESET"
                });
            }

            return "recovered";
        },
        {
            maxAttempts: 3,
            baseDelayMs: 0
        }
    );

    assert.equal(result, "recovered");
    assert.equal(calls, 2);
});


test("does not retry a non-retryable error", async () => {
    const expectedError = createError({
        statusCode: 400
    });

    let calls = 0;

    await assert.rejects(
        retry(
            async () => {
                calls += 1;
                throw expectedError;
            },
            {
                maxAttempts: 3,
                baseDelayMs: 0
            }
        ),
        error => error === expectedError
    );

    assert.equal(calls, 1);
});


test("throws the final error after exhausting all attempts", async () => {
    let calls = 0;

    const finalError = createError({
        code: "ETIMEDOUT"
    });

    await assert.rejects(
        retry(
            async () => {
                calls += 1;
                throw finalError;
            },
            {
                maxAttempts: 3,
                baseDelayMs: 0
            }
        ),
        error => error === finalError
    );

    assert.equal(calls, 3);
});


test("supports a custom retry policy", async () => {
    let calls = 0;

    const result = await retry(
        async () => {
            calls += 1;

            if (calls === 1) {
                throw new Error("Custom failure");
            }

            return "success";
        },
        {
            maxAttempts: 2,
            baseDelayMs: 0,
            shouldRetry: error =>
                error.message === "Custom failure"
        }
    );

    assert.equal(result, "success");
    assert.equal(calls, 2);
});


test("does not retry when the custom policy rejects the error", async () => {
    let calls = 0;

    await assert.rejects(
        retry(
            async () => {
                calls += 1;
                throw new Error("Do not retry");
            },
            {
                maxAttempts: 3,
                baseDelayMs: 0,
                shouldRetry: () => false
            }
        ),
        /Do not retry/
    );

    assert.equal(calls, 1);
});


test("supports a single maximum attempt", async () => {
    let calls = 0;

    await assert.rejects(
        retry(
            async () => {
                calls += 1;
                throw createError({
                    statusCode: 503
                });
            },
            {
                maxAttempts: 1,
                baseDelayMs: 0
            }
        ),
        /Test failure/
    );

    assert.equal(calls, 1);
});


test("rejects a non-function operation", async () => {
    await assert.rejects(
        retry(null),
        {
            name: "TypeError",
            message: "Retry operation must be a function."
        }
    );
});


test("rejects invalid maxAttempts", async () => {
    for (const maxAttempts of [
        0,
        -1,
        1.5,
        "3",
        NaN
    ]) {
        await assert.rejects(
            retry(async () => "success", {
                maxAttempts
            }),
            TypeError
        );
    }
});


test("rejects invalid baseDelayMs", async () => {
    for (const baseDelayMs of [
        -1,
        1.5,
        "100",
        NaN
    ]) {
        await assert.rejects(
            retry(async () => "success", {
                baseDelayMs
            }),
            TypeError
        );
    }
});


test("rejects invalid maxDelayMs", async () => {
    for (const maxDelayMs of [
        -1,
        1.5,
        "100",
        NaN
    ]) {
        await assert.rejects(
            retry(async () => "success", {
                maxDelayMs
            }),
            TypeError
        );
    }
});


test("rejects a non-function shouldRetry policy", async () => {
    await assert.rejects(
        retry(async () => "success", {
            shouldRetry: true
        }),
        {
            name: "TypeError",
            message: "Retry shouldRetry must be a function."
        }
    );
});


test("supports zero delay values", async () => {
    let calls = 0;

    const result = await retry(
        async () => {
            calls += 1;

            if (calls === 1) {
                throw createError({
                    statusCode: 503
                });
            }

            return "success";
        },
        {
            maxAttempts: 2,
            baseDelayMs: 0,
            maxDelayMs: 0
        }
    );

    assert.equal(result, "success");
    assert.equal(calls, 2);
});
