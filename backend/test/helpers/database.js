
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

let replicaSet;

/**
 * @name startTestDatabase
 * @description Starts an isolated in-memory MongoDB replica set
 * and connects Mongoose to it.
 *
 * @returns {Promise<void>}
 */
const startTestDatabase = async () => {
    replicaSet = await MongoMemoryReplSet.create({
        replSet: {
            count: 1,
            storageEngine: "wiredTiger"
        }
    });

    await mongoose.connect(replicaSet.getUri(), {
        serverSelectionTimeoutMS: 5000
    });
};

/**
 * @name clearTestDatabase
 * @description Clears all registered MongoDB collections.
 *
 * @returns {Promise<void>}
 */
const clearTestDatabase = async () => {
    const collections = Object.values(
        mongoose.connection.collections
    );

    await Promise.all(
        collections.map((collection) => collection.deleteMany({}))
    );
};

/**
 * @name stopTestDatabase
 * @description Disconnects Mongoose and stops the replica set.
 *
 * @returns {Promise<void>}
 */
const stopTestDatabase = async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    if (replicaSet) {
        await replicaSet.stop();
        replicaSet = null;
    }
};

export {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
};
