/**
 * Determines whether an error represents a retryable failure.
 *
 * This default policy handles common network errors and
 * retryable HTTP status codes. Individual integrations can
 * supply a custom retry policy when needed.
 *
 * @param {unknown} error - Error to inspect.
 * @returns {boolean} True when the operation may be retried.
 */
const isRetryableError = (error) => {
    if (typeof error !== "object" || error === null) {
        return false;
    }

    const retryableNetworkCodes = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED"
    ];

    if (retryableNetworkCodes.includes(error.code)) {
        return true;
    }

    if (error.statusCode === 408 || error.statusCode === 429) {
        return true;
    }

    return (
        Number.isInteger(error.statusCode) &&
        error.statusCode >= 500 &&
        error.statusCode <= 599
    );
};

/**
 * Delays execution for a specified duration.
 *
 * @param {number} milliseconds - Delay duration.
 * @returns {Promise<void>} Promise that resolves after the delay.
 */
const delay = (milliseconds) => {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
};

/**
 * Executes an asynchronous operation with retry support.
 *
 * Uses exponential backoff between attempts:
 *
 * - Attempt 1: Immediate execution.
 * - Attempt 2: Base delay.
 * - Attempt 3: Base delay multiplied by 2.
 * - Attempt 4: Base delay multiplied by 4.
 *
 * The delay is capped at maxDelayMs.
 *
 * Only use retries for operations that are safe to repeat.
 * For operations that modify data, use an appropriate
 * idempotency strategy to prevent duplicate side effects.
 *
 * @param {Function} operation - Asynchronous operation to execute.
 * @param {Object} [options] - Retry configuration.
 * @param {number} [options.maxAttempts=3] - Maximum total attempts.
 * @param {number} [options.baseDelayMs=250] - Initial backoff delay.
 * @param {number} [options.maxDelayMs=5000] - Maximum backoff delay.
 * @param {Function} [options.shouldRetry=isRetryableError] - Retry decision function.
 * @returns {Promise<*>} Result returned by the operation.
 * @throws {Error} The final error when execution fails.
 */
const retry = async (
    operation,
    {
        maxAttempts = 3,
        baseDelayMs = 250,
        maxDelayMs = 5000,
        shouldRetry = isRetryableError
    } = {}
) => {
    if (typeof operation !== "function") {
        throw new TypeError(
            "Retry operation must be a function."
        );
    }

    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
        throw new TypeError(
            "Retry maxAttempts must be a positive integer."
        );
    }

    if (!Number.isInteger(baseDelayMs) || baseDelayMs < 0) {
        throw new TypeError(
            "Retry baseDelayMs must be a non-negative integer."
        );
    }

    if (!Number.isInteger(maxDelayMs) || maxDelayMs < 0) {
        throw new TypeError(
            "Retry maxDelayMs must be a non-negative integer."
        );
    }

    if (typeof shouldRetry !== "function") {
        throw new TypeError(
            "Retry shouldRetry must be a function."
        );
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await operation();
        } catch (error) {
            const hasAttemptsRemaining = attempt < maxAttempts;

            if (
                !hasAttemptsRemaining ||
                !shouldRetry(error)
            ) {
                throw error;
            }

            const exponentialDelay =
                baseDelayMs * (2 ** (attempt - 1));

            const delayMs = Math.min(
                exponentialDelay,
                maxDelayMs
            );

            await delay(delayMs);
        }
    }
};

export {
    retry,
    isRetryableError
};