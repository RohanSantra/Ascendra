/**
 * Stores runtime state shared across the application process.
 *
 * Runtime state represents the current lifecycle of the running
 * application and is kept separate from environment configuration.
 */
const applicationState = {
    isShuttingDown: false
};

/**
 * Marks the application as shutting down.
 *
 * Once shutdown begins, readiness checks should report that
 * the application is no longer ready to receive new traffic.
 *
 * @returns {void}
 */
const markShuttingDown = () => {
    applicationState.isShuttingDown = true;
};

/**
 * Returns whether application shutdown has started.
 *
 * @returns {boolean} True when shutdown has started.
 */
const isApplicationShuttingDown = () => {
    return applicationState.isShuttingDown;
};

export {
    markShuttingDown,
    isApplicationShuttingDown
};