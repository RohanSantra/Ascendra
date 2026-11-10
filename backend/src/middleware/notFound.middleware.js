
import AppError from "../core/errors/AppError.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../core/constants/index.js";

/**
 * Handles requests that do not match any registered route.
 *
 * Converts unmatched requests into controlled AppError
 * instances so they are processed by the global
 * error-handling middleware.
 *
 * Must be registered after all application routes
 * and before the global error handler.
 *
 * @param {import("express").Request} req - Request object.
 * @param {import("express").Response} res - Response object.
 * @param {import("express").NextFunction} next - Next function.
 * @returns {void}
 */
const notFoundHandler = (req, res, next) => {
    const error = new AppError(
        "The requested route was not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.ROUTE_NOT_FOUND
    );

    next(error);
};

export default notFoundHandler;
