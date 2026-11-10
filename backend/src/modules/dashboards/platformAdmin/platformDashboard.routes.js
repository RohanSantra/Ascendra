import { Router } from "express";

import { authenticate } from "../../auth/auth.middleware.js";
import { authorizePlatformAdmin } from "../../auth/authorization.middleware.js";

import validateRequest from "../../../middleware/validate.middleware.js";

import {
    getPlatformDashboardController
} from "./platformDashboard.controller.js";

import {
    platformDashboardQuerySchema
} from "./platformDashboard.validation.js";


const router = Router();


/**
 * @route GET /platform-admin/dashboard
 * @description Retrieves aggregate platform-wide dashboard statistics.
 * @access Platform Admin
 */
router.get(
    "/dashboard",
    authenticate,
    authorizePlatformAdmin,
    validateRequest(platformDashboardQuerySchema, {
        query: true
    }),
    getPlatformDashboardController
);


export default router;