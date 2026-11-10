/**
 * Wraps an asynchronous Express request handler.
 *
 * Rejected promises are forwarded to Express error-handling
 * middleware, avoiding repetitive try/catch blocks in controllers.
 *
 * @param {Function} handler - Express request handler.
 * @returns {import("express").RequestHandler} Wrapped request handler.
 */
const asyncHandler = (handler) => {
    return (req, res, next) => {
        Promise
            .resolve(handler(req, res, next))
            .catch(next);
    };
};

export default asyncHandler;