import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.CLIENT_URL ||= "http://localhost:3000";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/ascendra_test";
process.env.JWT_ACCESS_SECRET ||= "test-access-secret-for-database";
process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret-for-database";

const {
    connectDatabase,
    disconnectDatabase,
    isDatabaseConnected
} = await import("../../../src/config/db.js");

test("connects using the configured MongoDB URI and bounded timeouts", async (t) => {
    let capturedArguments;
    t.mock.method(mongoose, "connect", async (...args) => {
        capturedArguments = args;
        return mongoose;
    });

    const result = await connectDatabase();

    assert.equal(result, mongoose);
    assert.equal(capturedArguments[0], process.env.MONGODB_URI);
    assert.deepEqual(capturedArguments[1], {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 45000
    });
});

test("reports the Mongoose connected state accurately", (t) => {
    const originalReadyState = mongoose.connection.readyState;
    t.after(() => {
        mongoose.connection.readyState = originalReadyState;
    });

    mongoose.connection.readyState = 0;
    assert.equal(isDatabaseConnected(), false);

    mongoose.connection.readyState = 1;
    assert.equal(isDatabaseConnected(), true);
});

test("does not close a database connection that is already disconnected", async (t) => {
    const originalReadyState = mongoose.connection.readyState;
    t.after(() => {
        mongoose.connection.readyState = originalReadyState;
    });

    mongoose.connection.readyState = 0;
    t.mock.method(mongoose.connection, "close", async () => {
        assert.fail("close should not be called for a disconnected connection");
    });

    await disconnectDatabase();
});

test("closes a live database connection during shutdown", async (t) => {
    const originalReadyState = mongoose.connection.readyState;
    let closeCalled = false;
    t.after(() => {
        mongoose.connection.readyState = originalReadyState;
    });

    mongoose.connection.readyState = 1;
    t.mock.method(mongoose.connection, "close", async () => {
        closeCalled = true;
    });

    await disconnectDatabase();

    assert.equal(closeCalled, true);
});
