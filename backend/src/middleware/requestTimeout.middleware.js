import AppError from "../core/errors/AppError.js";
import {
    HTTP_STATUS,
    ERROR_CODES
} from "../core/constants/index.js";

/**
 * Creates middleware that limits how long a request
 * is allowed to remain active.
 *
 * The timeout is handled as a controlled application
 * error and forwarded to the centralized error handler.
 *
 * @param {number} timeoutMs - Maximum request duration in milliseconds.
 * @returns {import("express").RequestHandler} Express middleware.
 */
const createRequestTimeout = (timeoutMs) => {
    if (
        !Number.isInteger(timeoutMs) ||
        timeoutMs <= 0
    ) {
        throw new TypeError(
            "Request timeout must be a positive integer"
        );
    }

    return (req, res, next) => {
        let timedOut = false;

        const timer = setTimeout(() => {
            if (res.headersSent) {
                return;
            }

            timedOut = true;

            next(
                new AppError(
                    "Request timed out",
                    HTTP_STATUS.REQUEST_TIMEOUT,
                    ERROR_CODES.REQUEST_TIMEOUT
                )
            );
        }, timeoutMs);

        res.on("finish", () => {
            clearTimeout(timer);
        });

        res.on("close", () => {
            clearTimeout(timer);
        });

        req.requestTimedOut = () => timedOut;

        next();
    };
};

export default createRequestTimeout;