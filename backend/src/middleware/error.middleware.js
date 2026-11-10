
import mongoose from "mongoose";

import AppError from "../core/errors/AppError.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../core/constants/index.js";

import { logger } from "../core/utils/index.js";

/**
 * Normalizes known errors into AppError instances.
 *
 * Third-party libraries may throw errors with different
 * structures. This function converts recognized errors
 * into the application's standard error format.
 *
 * Unknown errors are returned unchanged so they can
 * be handled as unexpected internal failures.
 *
 * @param {Error} error - Original application error.
 * @returns {Error} Normalized or original error.
 */
const normalizeError = (error) => {
    /**
     * Controlled application errors.
     */
    if (error instanceof AppError) {
        return error;
    }

    /**
     * Mongoose schema validation errors.
     */
    if (error instanceof mongoose.Error.ValidationError) {
        const details = Object.values(error.errors).map(
            (validationError) => ({
                field: validationError.path,
                message: validationError.message
            })
        );

        return new AppError(
            "Validation failed",
            HTTP_STATUS.UNPROCESSABLE_ENTITY,
            ERROR_CODES.VALIDATION_ERROR,
            details,
            error
        );
    }

    /**
     * Mongoose type-casting errors.
     *
     * Do not return the submitted value because it
     * may contain sensitive information.
     */
    if (error instanceof mongoose.Error.CastError) {
        return new AppError(
            "Invalid request value",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.INVALID_PARAMETER,
            {
                field: error.path
            },
            error
        );
    }

    /**
     * MongoDB duplicate-key errors.
     *
     * Error code 11000 indicates a unique index
     * constraint violation.
     */
    if (error?.code === 11000) {
        const fields = Object.keys(
            error.keyPattern || {}
        );

        return new AppError(
            "A resource with the provided value already exists",
            HTTP_STATUS.CONFLICT,
            ERROR_CODES.RESOURCE_ALREADY_EXISTS,
            { fields },
            error
        );
    }

    /**
     * Invalid JSON request bodies.
     *
     * Express body-parser uses this error type when
     * the incoming JSON cannot be parsed.
     */
    if (error?.type === "entity.parse.failed") {
        return new AppError(
            "Malformed JSON request body",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.INVALID_REQUEST,
            null,
            error
        );
    }

    /**
     * Request body exceeds the configured size limit.
     */
    if (error?.type === "entity.too.large") {
        return new AppError(
            "Request body exceeds the allowed size",
            HTTP_STATUS.PAYLOAD_TOO_LARGE,
            ERROR_CODES.PAYLOAD_TOO_LARGE,
            null,
            error
        );
    }


    /*
     * Optional authentication error handling.
     *
     * Enable these branches when the project implements JWT
     * authentication and includes the corresponding error codes
     * in src/core/constants/errorCodes.js.
     */

    /*
    // Invalid JWT.
    if (error?.name === "JsonWebTokenError") {
        return new AppError(
            "Invalid authentication token",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.INVALID_ACCESS_TOKEN,
            null,
            error
        );
    }

    // Expired JWT.
    if (error?.name === "TokenExpiredError") {
        return new AppError(
            "Authentication token has expired",
            HTTP_STATUS.UNAUTHORIZED,
            ERROR_CODES.ACCESS_TOKEN_EXPIRED,
            null,
            error
        );
    }
    */



    /**
     * Unknown errors remain unchanged.
     */
    return error;
};

/**
 * Global Express error-handling middleware.
 *
 * Responsibilities:
 * - Normalize known application and library errors.
 * - Prevent duplicate HTTP responses.
 * - Return consistent JSON error responses.
 * - Hide unexpected internal implementation details.
 * - Log unexpected failures.
 *
 * Must be registered after all application routes
 * and the not-found middleware.
 *
 * @param {Error} error - Original error.
 * @param {import("express").Request} req - Request object.
 * @param {import("express").Response} res - Response object.
 * @param {import("express").NextFunction} next - Next function.
 * @returns {void}
 */
const errorHandler = (error, req, res, next) => {
    /**
     * Delegate the error to Express when the
     * response headers have already been sent.
     */
    if (res.headersSent) {
        return next(error);
    }

    const normalizedError = normalizeError(error);

    /**
     * Only controlled AppError instances are
     * considered operational errors.
     */
    const isOperational =
        normalizedError instanceof AppError &&
        normalizedError.isOperational === true;

    /**
     * Determine the HTTP response status.
     */
    const statusCode = isOperational
        ? normalizedError.statusCode
        : HTTP_STATUS.INTERNAL_SERVER_ERROR;

    /**
     * Never expose internal server error messages
     * or implementation details to the client.
     */
    const isInternalError =
        statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR;

    const message = isInternalError
        ? "Internal server error"
        : normalizedError.message;

    const code = isInternalError
        ? ERROR_CODES.INTERNAL_SERVER_ERROR
        : normalizedError.code;

    const details = isInternalError
        ? null
        : normalizedError.details ?? null;

    /**
     * Log unexpected failures with request context.
     *
     * Operational client errors are not logged here unless
     * they indicate a server-side failure.
     *
     * Do not log request bodies, credentials, tokens,
     * or other sensitive information.
     */
    if (!isOperational || isInternalError) {
        logger.error("Request failed", {
            requestId: req.requestId ?? null,
            method: req.method,
            path: req.path,
            statusCode,
            errorCode: code,
            errorName: normalizedError?.name ?? "Error",
            errorMessage:
                normalizedError?.message ?? "Unknown error",
            ...(isInternalError && normalizedError?.stack
                ? { stack: normalizedError.stack }
                : {})
        });
    }

    /**
     * Return the standardized JSON error response.
     *
     * The requestId field will be populated once
     * request-ID middleware is implemented.
     */
    return res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        error: {
            code,
            details
        },
        requestId: req.requestId ?? null
    });
};

export default errorHandler;
