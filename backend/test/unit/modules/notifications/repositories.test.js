import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Notification from "../../../../src/modules/notifications/notification.model.js";
import {
    getNotifications
} from "../../../../src/modules/notifications/notification.repository.js";
import {
    createNotification,
    createManyNotifications,
    getNotificationById,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    countUnreadNotifications
} from "../../../../src/modules/notifications/notification.repository.js";
import {
    getUnreadNotificationCountController
} from "../../../../src/modules/notifications/notification.controller.js";

const createQuery = (result) => {
    const query = {
        populate() {
            return this;
        },

        sort(value) {
            this.sortValue = value;
            return this;
        },

        skip(value) {
            this.skipValue = value;
            return this;
        },

        limit(value) {
            this.limitValue = value;
            return this;
        },

        session() {
            return this;
        },

        lean() {
            return Promise.resolve(result);
        },

        then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
        }
    };

    return query;
};


test("notification repository scopes, filters, sorts, and paginates recipient results", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();
    const notification = { _id: new mongoose.Types.ObjectId() };
    let capturedFilter;
    let capturedCountFilter;
    let capturedSort;
    let capturedSkip;
    let capturedLimit;

    t.mock.method(Notification, "find", (filter) => {
        capturedFilter = filter;
        const query = createQuery([notification]);
        const sort = query.sort;
        const skip = query.skip;
        const limit = query.limit;
        query.sort = function (value) {
            capturedSort = value;
            return sort.call(this, value);
        };
        query.skip = function (value) {
            capturedSkip = value;
            return skip.call(this, value);
        };
        query.limit = function (value) {
            capturedLimit = value;
            return limit.call(this, value);
        };
        return query;
    });

    t.mock.method(Notification, "countDocuments", (filter) => {
        capturedCountFilter = filter;
        return createQuery(23);
    });

    const result = await getNotifications({
        orgId,
        recipientId,
        filters: {
            status: "unread",
            type: "general",
            expiresAt: true
        },
        pagination: { page: 3, limit: 5 },
        sort: { sortBy: "unsafeField", sortOrder: "asc" }
    });

    assert.equal(capturedFilter.org, orgId);
    assert.equal(capturedFilter.recipient, recipientId);
    assert.equal(capturedFilter.status, "unread");
    assert.equal(capturedFilter.type, "general");
    assert.deepEqual(capturedFilter.$or[0], { expiresAt: null });
    assert.ok(capturedFilter.$or[1].expiresAt.$gt instanceof Date);
    assert.ok(capturedFilter.$or[1].expiresAt.$gt instanceof Date);
    assert.deepEqual(capturedCountFilter, capturedFilter);
    assert.deepEqual(capturedSort, { createdAt: 1 });
    assert.equal(capturedSkip, 10);
    assert.equal(capturedLimit, 5);
    assert.deepEqual(result, {
        data: [notification],
        meta: { total: 23, page: 3, limit: 5, totalPages: 5 }
    });
});


test("notification repository creates single and bulk records with sessions", async (t) => {
    const session = {};
    const notification = { _id: new mongoose.Types.ObjectId() };
    let createOptions;
    let inserted;
    let insertOptions;
    t.mock.method(Notification, "create", async (_records, options) => {
        createOptions = options;
        return [notification];
    });
    t.mock.method(Notification, "insertMany", async (records, options) => {
        inserted = records;
        insertOptions = options;
        return records;
    });

    assert.equal(
        await createNotification({ title: "Hi" }, { session }),
        notification
    );
    assert.deepEqual(createOptions, { session });
    assert.deepEqual(await createManyNotifications([], { session }), []);
    assert.deepEqual(
        await createManyNotifications([{ title: "One" }], { session }),
        [{ title: "One" }]
    );
    assert.deepEqual(inserted, [{ title: "One" }]);
    assert.deepEqual(insertOptions, { session, ordered: false });
});


test("notification repository retrieves a user-scoped record and performs read transitions", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const recipientId = new mongoose.Types.ObjectId();
    const notificationId = new mongoose.Types.ObjectId();
    const session = {};
    const notification = { _id: notificationId, status: "read" };
    let findFilter;
    let updateFilter;
    let update;
    let updateOptions;
    let markAllFilter;
    let markAllUpdate;
    let markAllOptions;
    let countFilter;
    let countSession;

    t.mock.method(Notification, "findOne", (filter) => {
        findFilter = filter;
        return createQuery(notification);
    });
    t.mock.method(Notification, "findOneAndUpdate", (filter, updateDoc, options) => {
        updateFilter = filter;
        update = updateDoc;
        updateOptions = options;
        return createQuery(notification);
    });
    t.mock.method(Notification, "updateMany", async (filter, updateDoc, options) => {
        markAllFilter = filter;
        markAllUpdate = updateDoc;
        markAllOptions = options;
        return { matchedCount: 2, modifiedCount: 1 };
    });
    t.mock.method(Notification, "countDocuments", (filter) => {
        countFilter = filter;
        const result = createQuery(5);
        const originalSession = result.session;
        result.session = function (value) {
            countSession = value;
            return originalSession.call(this, value);
        };
        return result;
    });

    assert.equal(
        await getNotificationById(
            { orgId, recipientId, notificationId },
            { session }
        ),
        notification
    );
    assert.deepEqual(findFilter, {
        _id: notificationId,
        org: orgId,
        recipient: recipientId
    });
    assert.equal(
        await markNotificationAsRead(
            { orgId, recipientId, notificationId },
            { session }
        ),
        notification
    );
    assert.deepEqual(updateFilter, {
        _id: notificationId,
        org: orgId,
        recipient: recipientId,
        status: "unread"
    });
    assert.deepEqual(update.$set, { status: "read", readAt: update.$set.readAt });
    assert.ok(update.$set.readAt instanceof Date);
    assert.deepEqual(updateOptions, {
        returnDocument: "after",
        runValidators: true,
        session
    });
    assert.deepEqual(
        await markAllNotificationsAsRead(
            { orgId, recipientId },
            { session }
        ),
        { matchedCount: 2, modifiedCount: 1 }
    );
    assert.deepEqual(markAllFilter, {
        org: orgId,
        recipient: recipientId,
        status: "unread"
    });
    assert.deepEqual(markAllUpdate.$set, {
        status: "read",
        readAt: markAllUpdate.$set.readAt
    });
    assert.ok(markAllUpdate.$set.readAt instanceof Date);
    assert.deepEqual(markAllOptions, { session });
    assert.equal(
        await countUnreadNotifications({ orgId, recipientId }, { session }),
        5
    );
    assert.deepEqual(countFilter, {
        org: orgId,
        recipient: recipientId,
        status: "unread"
    });
    assert.equal(countSession, session);
});


test("notification controller returns the signed-in user's unread count", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    let capturedFilter;
    let responseBody;
    let responseStatus;
    const nextErrors = [];

    t.mock.method(Notification, "countDocuments", (filter) => {
        capturedFilter = filter;
        return createQuery(4);
    });

    const response = {
        status(status) {
            responseStatus = status;
            return this;
        },

        json(body) {
            responseBody = body;
            return this;
        }
    };

    getUnreadNotificationCountController(
        {
            user: { orgId, userId }
        },
        response,
        (error) => nextErrors.push(error)
    );

    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(capturedFilter, {
        org: orgId,
        recipient: userId,
        status: "unread"
    });
    assert.equal(responseStatus, 200);
    assert.equal(responseBody.data.unreadCount, 4);
    assert.equal(nextErrors.length, 0);
});
