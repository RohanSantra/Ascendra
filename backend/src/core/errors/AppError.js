import {
    HTTP_STATUS,
    ERROR_CODES
} from "../constants/index.js";

/**
 * Represents a controlled application error.
 *
 * Use AppError for expected failures that should produce a
 * known HTTP status code and application error code.
 *
 * Examples include missing resources, invalid requests,
 * and conflicts with existing resources.
 *
 * Unexpected programming errors should remain ordinary errors
 * so the global error handler can treat them as internal failures.
 *
 * @extends Error
 */
class AppError extends Error {
    /**
     * Creates a controlled application error.
     *
     * @param {string} message - Human-readable error message.
     * @param {number} [statusCode=500] - HTTP status code.
     * @param {string} [code] - Application-specific error code.
     * @param {*} [details=null] - Optional structured error details.
     * @param {Error|null} [cause=null] - Original underlying error.
     */
    constructor(
        message,
        statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
        code = ERROR_CODES.INTERNAL_SERVER_ERROR,
        details = null,
        cause = null
    ) {
        super(message, cause ? { cause } : undefined);

        if (
            !Number.isInteger(statusCode) ||
            statusCode < 400 ||
            statusCode > 599
        ) {
            throw new TypeError(
                "AppError statusCode must be an integer between 400 and 599."
            );
        }

        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;

        /**
         * Indicates that the error represents an expected
         * application-level failure.
         *
         * The global error handler can use this property to
         * distinguish controlled errors from unexpected errors.
         *
         * @type {boolean}
         */
        this.isOperational = true;

        // Exclude the constructor call from the stack trace when supported.
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AppError);
        }
    }
}

export default AppError;