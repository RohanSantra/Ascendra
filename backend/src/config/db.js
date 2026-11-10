
import mongoose from "mongoose";

import env from "./env.js";
import { logger } from "../core/utils/logger.js";

/**
 * MongoDB connection options.
 *
 * These values prevent connection attempts and database
 * operations from waiting indefinitely.
 */
const MONGODB_OPTIONS = Object.freeze({
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 45000
});

/**
 * Handles successful MongoDB connections.
 */
mongoose.connection.on("connected", () => {
    logger.info("MongoDB connected", {
        host: mongoose.connection.host,
        database: mongoose.connection.name
    });
});

/**
 * Handles MongoDB connection errors.
 *
 * @param {Error} error - MongoDB connection error.
 */
mongoose.connection.on("error", (error) => {
    logger.error("MongoDB connection error", {
        errorName: error.name,
        errorMessage: error.message
    });
});

/**
 * Handles MongoDB disconnection events.
 */
mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
});

/**
 * Handles MongoDB connection attempts.
 */
mongoose.connection.on("connecting", () => {
    logger.info("MongoDB connecting");
});

/**
 * Handles successful MongoDB reconnections.
 */
mongoose.connection.on("reconnected", () => {
    logger.info("MongoDB reconnected");
});

/**
 * Establishes a connection to MongoDB.
 *
 * The HTTP server must connect to MongoDB successfully
 * before it starts accepting requests.
 *
 * Mongoose manages reconnection after temporary
 * network interruptions.
 *
 * @returns {Promise<typeof mongoose>} Connected Mongoose instance.
 * @throws {Error} When the initial database connection fails.
 */
const connectDatabase = async () => {
    return mongoose.connect(
        env.database.uri,
        MONGODB_OPTIONS
    );
};

/**
 * Closes the active MongoDB connection.
 *
 * Used during graceful application shutdown.
 *
 * @returns {Promise<void>}
 */
const disconnectDatabase = async () => {
    if (mongoose.connection.readyState === 0) {
        return;
    }

    await mongoose.connection.close();

    logger.info("MongoDB connection closed");
};

/**
 * Returns whether MongoDB is currently connected.
 *
 * Mongoose connection states:
 * 0 = disconnected
 * 1 = connected
 * 2 = connecting
 * 3 = disconnecting
 *
 * @returns {boolean} True when MongoDB is connected.
 */
const isDatabaseConnected = () => {
    return mongoose.connection.readyState === 1;
};

export {
    connectDatabase,
    disconnectDatabase,
    isDatabaseConnected
};
