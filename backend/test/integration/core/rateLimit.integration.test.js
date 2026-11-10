import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import createRateLimiter from "../../../src/middleware/rateLimit.middleware.js";

const withServer = async (handler, callback) => {
    const server = handler.listen(0);

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    try {
        const address = server.address();
        await callback(`http://127.0.0.1:${address.port}`);
    } finally {
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
};

test("rejects invalid rate-limit windows and request limits", () => {
    for (const options of [
        { windowMs: 0, max: 1 },
        { windowMs: 1000, max: 0 },
        { windowMs: 1.5, max: 1 },
        { windowMs: 1000, max: 1.5 }
    ]) {
        assert.throws(() => createRateLimiter(options), {
            name: "TypeError"
        });
    }
});

test("returns the configured response after exceeding the request limit", async () => {
    const app = express();
    app.use(createRateLimiter({
        windowMs: 60_000,
        max: 1,
        message: "Slow down."
    }));
    app.get("/", (req, res) => res.status(200).json({ success: true }));

    await withServer(app, async (baseUrl) => {
        const firstResponse = await fetch(baseUrl);
        const secondResponse = await fetch(baseUrl);
        const body = await secondResponse.json();

        assert.equal(firstResponse.status, 200);
        assert.equal(secondResponse.status, 429);
        assert.equal(body.success, false);
        assert.equal(body.statusCode, 429);
        assert.equal(body.message, "Slow down.");
        assert.equal(body.error.code, "RATE_LIMIT_EXCEEDED");
        assert.equal(body.error.details, null);
    });
});
