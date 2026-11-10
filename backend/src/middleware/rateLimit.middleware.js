import rateLimit from "express-rate-limit";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../core/constants/index.js";

/**
 * Creates a configurable Express rate limiter.
 *
 * The default in-memory store is suitable for a single
 * application instance.
 *
 * Distributed deployments should use a shared store,
 * such as Redis, when rate-limit state must be shared
 * across multiple application instances.
 *
 * @param {Object} options - Rate limiter configuration.
 * @param {number} options.windowMs - Rate-limit window duration.
 * @param {number} options.max - Maximum requests per window.
 * @param {string} [options.message] - Client-facing message.
 * @returns {import("express").RequestHandler} Rate-limit middleware.
 */
const createRateLimiter = ({
    windowMs,
    max,
    message = "Too many requests. Please try again later."
}) => {
    if (!Number.isInteger(windowMs) || windowMs <= 0) {
        throw new TypeError(
            "Rate limiter windowMs must be a positive integer"
        );
    }

    if (!Number.isInteger(max) || max <= 0) {
        throw new TypeError(
            "Rate limiter max must be a positive integer"
        );
    }

    return rateLimit({
        windowMs,
        limit: max,

        standardHeaders: "draft-7",

        legacyHeaders: false,

        handler: (req, res) => {
            return res
                .status(HTTP_STATUS.TOO_MANY_REQUESTS)
                .json({
                    success: false,
                    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
                    message,
                    error: {
                        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
                        details: null
                    },
                    requestId: req.requestId ?? null
                });
        }
    });
};

export default createRateLimiter;