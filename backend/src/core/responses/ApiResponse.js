/**
 * Builds standardized successful API responses.
 *
 * Use this class to keep the structure of successful responses
 * consistent across application modules.
 *
 * Error responses are handled separately by the global
 * error-handling middleware.
 */
class ApiResponse {
    /**
     * Creates a standardized API response object.
     *
     * @param {Object} options - Response configuration.
     * @param {number} options.statusCode - HTTP status code.
     * @param {string} options.message - Human-readable response message.
     * @param {*} [options.data=null] - Response payload.
     * @param {*} [options.meta=null] - Optional response metadata.
     * @param {string|null} [options.requestId=null] - Request correlation ID.
     */
    constructor({
        statusCode,
        message,
        data = null,
        meta = null,
        requestId = null
    }) {
        this.success = true;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.meta = meta;
        this.requestId = requestId;
    }

    /**
     * Sends a standardized successful API response.
     *
     * @param {import("express").Response} res - Express response object.
     * @param {Object} options - Response configuration.
     * @param {number} options.statusCode - HTTP status code.
     * @param {string} options.message - Human-readable response message.
     * @param {*} [options.data=null] - Response payload.
     * @param {*} [options.meta=null] - Optional response metadata.
     * @returns {import("express").Response} Express response.
     */
    static send(
        res,
        {
            statusCode,
            message,
            data = null,
            meta = null
        }
    ) {
        if (
            !Number.isInteger(statusCode) ||
            statusCode < 200 ||
            statusCode > 299 ||
            statusCode === 204
        ) {
            throw new TypeError(
                "ApiResponse.send requires a successful HTTP status code other than 204."
            );
        }

        return res.status(statusCode).json(
            new ApiResponse({
                statusCode,
                message,
                data,
                meta,
                requestId: res.req?.requestId ?? null
            })
        );
    }

    /**
     * Sends a 200 OK response.
     *
     * @param {import("express").Response} res - Express response object.
     * @param {string} message - Response message.
     * @param {*} [data=null] - Response payload.
     * @param {*} [meta=null] - Optional response metadata.
     * @returns {import("express").Response} Express response.
     */
    static ok(res, message, data = null, meta = null) {
        return ApiResponse.send(res, {
            statusCode: 200,
            message,
            data,
            meta
        });
    }

    /**
     * Sends a 201 Created response.
     *
     * Use this when a resource has been created successfully.
     *
     * @param {import("express").Response} res - Express response object.
     * @param {string} message - Response message.
     * @param {*} [data=null] - Created resource.
     * @param {*} [meta=null] - Optional response metadata.
     * @returns {import("express").Response} Express response.
     */
    static created(res, message, data = null, meta = null) {
        return ApiResponse.send(res, {
            statusCode: 201,
            message,
            data,
            meta
        });
    }

    /**
     * Sends a 202 Accepted response.
     *
     * Use this when a request has been accepted for processing
     * but the requested operation has not necessarily completed.
     *
     * @param {import("express").Response} res - Express response object.
     * @param {string} message - Response message.
     * @param {*} [data=null] - Optional response payload.
     * @param {*} [meta=null] - Optional response metadata.
     * @returns {import("express").Response} Express response.
     */
    static accepted(res, message, data = null, meta = null) {
        return ApiResponse.send(res, {
            statusCode: 202,
            message,
            data,
            meta
        });
    }

    /**
     * Sends a 204 No Content response.
     *
     * A 204 response must not contain a response body.
     *
     * @param {import("express").Response} res - Express response object.
     * @returns {import("express").Response} Express response.
     */
    static noContent(res) {
        return res.status(204).send();
    }
}

export default ApiResponse;