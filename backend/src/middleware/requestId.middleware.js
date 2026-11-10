import { randomUUID } from "node:crypto";

/**
 * Assigns a unique identifier to every incoming request.
 *
 * The identifier is stored on `req.requestId` and returned
 * through the `X-Request-ID` response header.
 *
 * A valid UUID supplied by a trusted upstream system can be
 * reused. Otherwise, the application generates a new UUID.
 *
 * Request IDs allow logs, errors, services and external
 * requests to be correlated with a single HTTP request.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Express next function.
 * @returns {void}
 */
const requestId = (req, res, next) => {
    const incomingRequestId = req.get("X-Request-ID");

    const isValidUUID = (value) => {
        if (!value) {
            return false;
        }

        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(value.trim());
    };

    const id = isValidUUID(incomingRequestId)
        ? incomingRequestId.trim()
        : randomUUID();

    req.requestId = id;

    res.setHeader("X-Request-ID", id);

    next();
};

export default requestId;