import { env } from "../../config/index.js";
import { formatTimestamp } from "./index.js";

/**
 * Centralized application logger.
 *
 * Development logs use a readable, multi-line format.
 * Production logs use structured JSON for log aggregation.
 *
 * @param {"info"|"warn"|"error"} level - Log severity.
 * @param {string} message - Log message.
 * @param {object} metadata - Additional log context.
 * @returns {void}
 */

const isProduction = env.nodeEnv === "production";

/**
 * Writes an application log entry.
 *
 * @param {"info"|"warn"|"error"} level
 * @param {string} message
 * @param {object} metadata
 */
const writeLog = (level, message, metadata = {}) => {
    const entry = {
        timestamp: formatTimestamp(),
        level: level.toUpperCase(),
        message,
        ...metadata
    };

    // Keep structured JSON logs in production.
    if (isProduction) {
        const output = JSON.stringify(entry);

        if (level === "error") {
            console.error(output);
        } else if (level === "warn") {
            console.warn(output);
        } else {
            console.log(output);
        }

        return;
    }

    // Use readable multi-line logs during development.
    const separator = "-".repeat(70);

    const lines = [
        "",
        separator,
        `[${entry.level}] ${entry.message}`,
        `Time      : ${entry.timestamp}`
    ];

    const labels = {
        requestId: "Request ID",
        method: "Method",
        path: "Path",
        statusCode: "Status",
        errorCode: "Error Code",
        errorName: "Error Type",
        errorMessage: "Error Message"
    };

    for (const [key, label] of Object.entries(labels)) {
        if (entry[key] !== undefined && entry[key] !== null) {
            lines.push(`${label.padEnd(12)}: ${entry[key]}`);
        }
    }

    if (entry.stack) {
        lines.push("", "Stack Trace:", entry.stack);
    }

    lines.push(separator, "");

    const output = lines.join("\n");

    if (level === "error") {
        console.error(output);
    } else if (level === "warn") {
        console.warn(output);
    } else {
        console.log(output);
    }
};

/**
 * Shared logger methods.
 */
export const logger = {
    info: (message, metadata = {}) =>
        writeLog("info", message, metadata),

    warn: (message, metadata = {}) =>
        writeLog("warn", message, metadata),

    error: (message, metadata = {}) =>
        writeLog("error", message, metadata)
};