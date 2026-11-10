import ApiResponse from "../../core/responses/ApiResponse.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import {
    isDatabaseConnected
} from "../../config/index.js";

import {
    isApplicationShuttingDown
} from "../../core/runtime/index.js";

/**
 * Checks whether the application process is alive.
 *
 * Liveness checks intentionally do not depend on database
 * connectivity or optional infrastructure.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} Liveness response.
 */
const liveness = (req, res) => {
    return ApiResponse.ok(
        res,
        "Service is alive",
        {
            status: "alive"
        }
    );
};

/**
 * Checks whether the application is ready to serve traffic.
 *
 * Readiness requires the application to be running normally
 * and connected to MongoDB.
 *
 * Optional infrastructure checks can be added when a project
 * integrates services such as Redis or other dependencies.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} Readiness response.
 */
const readiness = (req, res) => {
    const shuttingDown = isApplicationShuttingDown();
    const databaseConnected = isDatabaseConnected();

    const dependencies = {
        database: databaseConnected
            ? "available"
            : "unavailable"
    };

    /*
     * Optional infrastructure readiness.
     *
     * Enable this section when the project implements an
     * infrastructure readiness registry and exports
     * getInfrastructureReadiness() from core/runtime/index.js.
     *
     * const infrastructure = getInfrastructureReadiness();
     *
     * Object.assign(
     *     dependencies,
     *     infrastructure.dependencies
     * );
     */

    const dependenciesReady =
        databaseConnected;
        // Add infrastructure.ready to this condition when
        // optional infrastructure readiness is implemented.

    if (shuttingDown || !dependenciesReady) {
        const message = shuttingDown
            ? "Service is shutting down"
            : "Service is not ready";

        return res.status(
            HTTP_STATUS.SERVICE_UNAVAILABLE
        ).json({
            success: false,
            statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
            message,
            error: {
                code: ERROR_CODES.SERVICE_UNAVAILABLE,
                details: {
                    status: "not_ready",
                    dependencies
                }
            },
            requestId: req.requestId ?? null
        });
    }

    return ApiResponse.ok(
        res,
        "Service is ready",
        {
            status: "ready",
            dependencies
        }
    );
};

export {
    liveness,
    readiness
};  