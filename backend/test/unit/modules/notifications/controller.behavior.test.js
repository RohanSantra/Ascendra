import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Notification from "../../../../src/modules/notifications/notification.model.js";
import {
    listNotificationsController
} from "../../../../src/modules/notifications/notification.controller.js";
import {
    getNotificationController,
    markNotificationAsReadController,
    markAllNotificationsAsReadController,
    getUnreadNotificationCountController
} from "../../../../src/modules/notifications/notification.controller.js";

const id = () => new mongoose.Types.ObjectId();


const query = (value) => ({
    select() {
        return this;
    },
    populate() {
        return this;
    },
    sort() {
        return this;
    },
    skip() {
        return this;
    },
    limit() {
        return this;
    },
    session() {
        return this;
    },
    lean() {
        return Promise.resolve(value);
    },
    then(resolve, reject) {
        return Promise.resolve(value).then(resolve, reject);
    }
});


const invoke = async (handler, req) => {
    let status;
    let body;
    const errors = [];
    const res = {
        req: {},
        status(value) {
            status = value;
            return this;
        },
        json(value) {
            body = value;
            return this;
        }
    };

    handler(req, res, (error) => errors.push(error));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(errors, []);
    return { status, body };
};


test("notification controller maps query filters to user-scoped list output", async (t) => {
    const orgId = id();
    const userId = id();
    const notification = {
        _id: id(),
        org: orgId,
        recipient: userId,
        title: "Update",
        message: "An update",
        status: "unread",
        type: "general",
        channels: ["in_app"],
        createdAt: new Date()
    };
    t.mock.method(Notification, "find", () => query([notification]));
    t.mock.method(Notification, "countDocuments", () => query(1));

    const response = await invoke(listNotificationsController, {
        user: { orgId, userId },
        validated: {
            query: {
                page: 1,
                limit: 10,
                status: "unread",
                type: "general",
                sortOrder: "asc"
            }
        }
    });







    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, [notification]);
    assert.deepEqual(response.body.meta, {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1
    });
});


test("notification controller retrieves an individual recipient notification", async (t) => {
    const orgId = id();
    const userId = id();
    const notificationId = id();
    const notification = {
        _id: notificationId.toString(),
        org: orgId,
        recipient: userId,
        status: "unread",
        expiresAt: null
    };
    t.mock.method(Notification, "findOne", () => query(notification));

    const response = await invoke(getNotificationController, {
        user: { orgId, userId },
        validated: { params: { notificationId: notificationId.toString() } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data, notification);
});


test("notification controller marks an unread notification as read", async (t) => {
    const orgId = id();
    const userId = id();
    const notificationId = id();
    const notification = {
        _id: notificationId,
        org: orgId,
        recipient: userId,
        status: "unread",
        expiresAt: null
    };
    let updateFilter;
    t.mock.method(Notification, "findOne", () => query(notification));
    t.mock.method(Notification, "findOneAndUpdate", (filter) => {
        updateFilter = filter;
        return query({ ...notification, status: "read" });
    });

    const response = await invoke(markNotificationAsReadController, {
        user: { orgId, userId },
        validated: { params: { notificationId: notificationId.toString() } }
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, "read");
    assert.deepEqual(updateFilter, {
        _id: notificationId.toString(),
        org: orgId,
        recipient: userId,
        status: "unread"
    });
});


test("notification controller marks all notifications and retrieves unread count", async (t) => {
    const orgId = id();
    const userId = id();
    let updateFilter;
    let countFilter;
    t.mock.method(Notification, "updateMany", async (filter) => {
        updateFilter = filter;
        return { matchedCount: 3, modifiedCount: 3 };
    });
    t.mock.method(Notification, "countDocuments", (filter) => {
        countFilter = filter;
        return query(3);
    });

    const markResponse = await invoke(markAllNotificationsAsReadController, {
        user: { orgId, userId }
    });
    const countResponse = await invoke(getUnreadNotificationCountController, {
        user: { orgId, userId }
    });

    assert.equal(markResponse.status, 200);
    assert.deepEqual(markResponse.body.data, {
        matchedCount: 3,
        modifiedCount: 3
    });
    assert.deepEqual(updateFilter, {
        org: orgId,
        recipient: userId,
        status: "unread"
    });
    assert.equal(countResponse.status, 200);
    assert.deepEqual(countResponse.body.data, { unreadCount: 3 });
    assert.deepEqual(countFilter, {
        org: orgId,
        recipient: userId,
        status: "unread"
    });
});
