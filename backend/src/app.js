import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";

import { env } from "./config/index.js";

import {
    errorHandler,
    notFoundHandler,
    requestId,
    createRateLimiter,
    createRequestTimeout
} from "./middleware/index.js";

import apiRoutes from "./routes/index.js";

/**
 * Creates and configures the Express application.
 *
 * This module is responsible only for configuring
 * the HTTP application.
 *
 * It does not:
 * - Start the HTTP server.
 * - Connect to MongoDB.
 * - Handle process-level shutdown.
 *
 * @returns {import("express").Express} Configured Express application.
 */
const createApp = () => {
    const app = express();

    /**
     * Prevents Express from exposing
     * the X-Powered-By response header.
     */
    app.disable("x-powered-by");

    /**
     * Security-related HTTP headers.
     *
     * CSP is disabled because this application
     * currently serves an API rather than HTML pages.
     */
    app.use(
        helmet({
            contentSecurityPolicy: false
        })
    );

    /**
     * Assign a request correlation ID before
     * any other application middleware.
     */
    app.use(requestId);

    /**
     * Allow requests only from the configured frontend.
     */
    app.use(
        cors({
            origin: env.client.url,
            credentials: true,
            methods: [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
            ],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "X-Request-ID",
                "X-Organization-Id"
            ]
        })
    );

    /**
     * Compress HTTP responses.
     */
    app.use(compression());

    /**
     * Global request rate limiter.
     */
    const globalRateLimiter = createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 300
    });

    app.use(globalRateLimiter);

    /**
    * Global request Timeout.
    */
    const requestTimeout = createRequestTimeout(
        30_000
    );

    app.use(requestTimeout);

    /**
     * Parse JSON request bodies with a
     * deliberately conservative default limit.
     */
    app.use(
        express.json({
            limit: "500kb"
        })
    );

    /**
     * Parse URL-encoded request bodies.
     *
     * `extended: false` uses the simpler parser
     * because complex nested objects are not required
     * by the generic foundation.
     */
    app.use(
        express.urlencoded({
            extended: false,
            limit: "500kb"
        })
    );

    /**
     * Parse HTTP cookies.
     *
     * The auth module reads the HTTP-only refresh-token cookie
     * when rotating or revoking a session.
     */
    app.use(cookieParser());


    /** 
     * Register API routes through the central route composition.
    */
    app.use(
        `/api/${env.app.apiVersion}`,
        apiRoutes
    );

    /**
     * Handle unknown routes.
     */
    app.use(notFoundHandler);

    /**
     * Handle all application errors.
     */
    app.use(errorHandler);

    return app;
};

const app = createApp();

export default app;