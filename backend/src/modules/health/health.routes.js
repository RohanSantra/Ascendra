import express from "express";

import {
    liveness,
    readiness
} from "./health.controller.js";

import {
    asyncHandler
} from "../../core/utils/index.js";

const router = express.Router();

/**
 * Liveness probe.
 */
router.get(
    "/live",
    asyncHandler(liveness)
);

/**
 * Readiness probe.
 */
router.get(
    "/ready",
    asyncHandler(readiness)
);


export default router;