import {
    HTTP_STATUS,
    ERROR_CODES
} from "../core/constants/index.js";

import AppError from "../core/errors/AppError.js";

/**
 * Creates request validation middleware from a Zod schema.
 *
 * Validated values are stored in req.validated rather than
 * replacing Express request properties.
 *
 * The schema should validate an object containing whichever
 * request sections are enabled through the options.
 *
 * @param {Object} schema - Zod schema.
 * @param {Function} schema.parseAsync - Zod asynchronous parser.
 * @param {Object} [options] - Request sections to validate.
 * @param {boolean} [options.body=false] - Validate request body.
 * @param {boolean} [options.params=false] - Validate route parameters.
 * @param {boolean} [options.query=false] - Validate query parameters.
 * @param {boolean} [options.headers=false] - Validate request headers.
 * @returns {import("express").RequestHandler} Validation middleware.
 */
const validateRequest = (
    schema,
    {
        body = false,
        params = false,
        query = false,
        headers = false
    } = {}
) => {
    if (
        !schema ||
        typeof schema.parseAsync !== "function"
    ) {
        throw new TypeError(
            "Validation schema must provide a parseAsync function."
        );
    }

    const sections = {
        body,
        params,
        query,
        headers
    };

    if (
        !Object.values(sections).every(
            (enabled) => typeof enabled === "boolean"
        )
    ) {
        throw new TypeError(
            "Validation options must be booleans."
        );
    }

    if (!Object.values(sections).some(Boolean)) {
        throw new TypeError(
            "At least one request section must be enabled for validation."
        );
    }

    return async (req, res, next) => {
        try {
            const requestData = {};

            if (body) {
                requestData.body = req.body;
            }

            if (params) {
                requestData.params = req.params;
            }

            if (query) {
                requestData.query = req.query;
            }

            if (headers) {
                requestData.headers = req.headers;
            }

            const validatedData = await schema.parseAsync(requestData);

            req.validated = {
                ...(req.validated || {}),
                ...validatedData
            };

            return next();
        } catch (error) {
            if (error?.name === "ZodError") {
                const details = error.issues.map((issue) => ({
                    field: issue.path.length
                        ? issue.path.join(".")
                        : "request",
                    message: issue.message
                }));

                return next(
                    new AppError(
                        "Validation failed",
                        HTTP_STATUS.UNPROCESSABLE_ENTITY,
                        ERROR_CODES.VALIDATION_ERROR,
                        details,
                        error
                    )
                );
            }

            return next(error);
        }
    };
};

export default validateRequest;