import app from "./app.js";

import {
    env,
    connectDatabase,
    disconnectDatabase
} from "./config/index.js";

import {
    markShuttingDown,
    isApplicationShuttingDown
} from "./core/runtime/index.js";

import { logger } from "./core/utils/logger.js";

/**
 * HTTP server instance.
 *
 * Kept outside the startup function so the
 * shutdown handler can access it.
 */
let server = null;

/**
 * Maximum amount of time allowed for graceful shutdown.
 */
const SHUTDOWN_TIMEOUT = 10_000;

/**
 * Starts the application.
 *
 * The database connection is established before the
 * HTTP server begins accepting requests.
 *
 * @returns {Promise<void>}
 */
const startServer = async () => {
    try {
        await connectDatabase();

        server = app.listen(
            env.app.port,
            () => {
                logger.info("HTTP server started", {
                    appName: env.app.name,
                    port: env.app.port,
                    environment: env.app.nodeEnv
                });
            }
        );

        /**
         * Handles HTTP server errors that occur after
         * the server instance has been created.
         */
        server.on("error", (error) => {
            logger.error("HTTP server error", {
                errorName: error.name,
                errorMessage: error.message,
                stack: error.stack
            });

            void gracefulShutdown("HTTP_SERVER_ERROR", 1);
        });
    } catch (error) {
        logger.error("Application startup failed", {
            errorName: error.name,
            errorMessage: error.message
        });

        process.exit(1);
    }
};

/**
 * Gracefully shuts down the application.
 *
 * The shared runtime state prevents multiple shutdown
 * sequences from executing simultaneously.
 *
 * @param {string} signal - Shutdown signal or failure source.
 * @param {number} [exitCode=0] - Process exit code.
 * @returns {Promise<void>}
 */
const gracefulShutdown = async (signal, exitCode = 0) => {
    if (isApplicationShuttingDown()) {
        return;
    }

    markShuttingDown();

    logger.info("Graceful shutdown initiated", {
        signal,
        exitCode
    });

    const shutdownTimer = setTimeout(() => {
        logger.error("Graceful shutdown timed out", {
            timeoutMs: SHUTDOWN_TIMEOUT
        });

        process.exit(1);
    }, SHUTDOWN_TIMEOUT);

    try {
        if (server?.listening) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });

            logger.info("HTTP server closed successfully");
        }

        await disconnectDatabase();

        clearTimeout(shutdownTimer);

        logger.info("Application shutdown completed", {
            signal,
            exitCode
        });

        process.exit(exitCode);
    } catch (error) {
        clearTimeout(shutdownTimer);

        logger.error("Graceful shutdown failed", {
            signal,
            errorName: error.name,
            errorMessage: error.message,
            stack: error.stack
        });

        process.exit(1);
    }
};

/**
 * Handles operating-system shutdown signals.
 */
process.on("SIGINT", () => {
    void gracefulShutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void gracefulShutdown("SIGTERM");
});

/**
 * Handles unhandled promise rejections.
 */
process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
        reason:
            reason instanceof Error
                ? reason.message
                : String(reason),
        stack:
            reason instanceof Error
                ? reason.stack
                : undefined
    });

    void gracefulShutdown("UNHANDLED_REJECTION", 1);
});

/**
 * Handles uncaught exceptions.
 */
process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack
    });

    void gracefulShutdown("UNCAUGHT_EXCEPTION", 1);
});

/**
 * Start the application.
 */
void startServer();