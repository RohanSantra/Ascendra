import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Notification from "../../../../src/modules/notifications/notification.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import {
    createInAppNotification,
    createAnnouncementNotifications,
    getUserNotification,
    listUserNotifications,
    markUserNotificationAsRead,
    markAllUserNotificationsAsRead,
    getUnreadNotificationCount
} from "../../../../src/modules/notifications/notification.service.js";

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


test("notification service creates in-app notifications with validated references", async (t) => {
    const org = id();
    const recipient = id();
    const actor = id();
    let createdData;
    t.mock.method(Notification, "create", async ([data]) => {
        createdData = data;
        return [{ _id: id(), ...data }];
    });













    const result = await createInAppNotification({
        org,
        recipient,
        actor,
        title: "Update",
        message: "There is an update."
    });

    assert.equal(createdData.org, org);
    assert.equal(createdData.recipient, recipient);
    assert.equal(createdData.actor, actor);
    assert.deepEqual(createdData.channels, ["in_app"]);
    assert.equal(createdData.type, "general");
    assert.equal(result.title, "Update");
    await assert.rejects(
        () => createInAppNotification({
            org: "invalid",
            recipient,
            title: "Bad",
            message: "Bad reference"
        }),
        /Invalid notification reference/
    );
});


test("announcement notifications target approved audience members except the publisher", async (t) => {
    const orgId = id();
    const actorId = id();
    const recipientId = id();
    const announcementId = id();
    let capturedMembershipFilter;
    let inserted;
    t.mock.method(OrganizationMembership, "find", (filter) => {
        capturedMembershipFilter = filter;
        return query([{ user: recipientId }]);
    });
    t.mock.method(Notification, "insertMany", async (records, options) => {
        inserted = { records, options };
        return records;
    });

    const result = await createAnnouncementNotifications({
        orgId,
        actorId,
        announcementId,
        title: "Schedule",
        message: "The schedule changed.",
        audience: "trainers"
    });

    assert.deepEqual(capturedMembershipFilter, {
        org: orgId,
        role: { $in: ["trainer"] },
        status: "approved",
        user: { $ne: actorId }
    });
    assert.equal(inserted.records[0].recipient, recipientId);
    assert.equal(inserted.records[0].type, "announcement_published");
    assert.deepEqual(inserted.records[0].resource, {
        type: "announcement",
        id: announcementId
    });
    assert.deepEqual(inserted.options, { session: null, ordered: false });
    assert.equal(result.length, 1);
});


test("announcement notifications skip insertion when there are no eligible members", async (t) => {
    t.mock.method(OrganizationMembership, "find", () => query([]));
    const insertMany = t.mock.method(Notification, "insertMany", async () => {
        throw new Error("should not insert an empty batch");
    });

    assert.deepEqual(await createAnnouncementNotifications({
        orgId: id(),
        actorId: id(),
        announcementId: id(),
        title: "Notice",
        message: "Message",
        audience: "everyone"
    }), []);
    assert.equal(insertMany.mock.callCount(), 0);
});


test("notification service returns unexpired records and rejects invalid or expired identifiers", async (t) => {
    const orgId = id();
    const userId = id();
    const notificationId = id();
    const notification = {
        _id: notificationId,
        status: "unread",
        expiresAt: new Date(Date.now() + 60000)
    };
    let capturedFilter;
    let currentResult = notification;
    t.mock.method(Notification, "findOne", (filter) => {
        capturedFilter = filter;
        return query(currentResult);
    });

    assert.equal(await getUserNotification({
        orgId,
        userId,
        notificationId
    }), notification);
    assert.deepEqual(capturedFilter, {
        _id: notificationId,
        org: orgId,
        recipient: userId
    });
    await assert.rejects(
        () => getUserNotification({ orgId, userId, notificationId: "bad" }),
        (error) => error.statusCode === 400
    );

    currentResult = {
        status: "unread",
        expiresAt: new Date(Date.now() - 60000)
    };
    await assert.rejects(
        () => getUserNotification({ orgId, userId, notificationId }),
        (error) => error.statusCode === 404 && /expired/.test(error.message)
    );
});


test("notification service lists scoped filters with an expiry cutoff", async (t) => {
    const orgId = id();
    const userId = id();
    let filter;
    let countFilter;
    t.mock.method(Notification, "find", (queryFilter) => {
        filter = queryFilter;
        return query([{ _id: id() }]);
    });
    t.mock.method(Notification, "countDocuments", (queryFilter) => {
        countFilter = queryFilter;
        return query(1);
    });

    const result = await listUserNotifications({
        orgId,
        userId,
        filters: { status: "unread" },
        pagination: { page: 1, limit: 10 },
        sort: { sortBy: "createdAt", sortOrder: "desc" }
    });

    assert.deepEqual(filter, countFilter);
    assert.equal(filter.org, orgId);
    assert.equal(filter.recipient, userId);
    assert.equal(filter.status, "unread");
    assert.ok(filter.$or[1].expiresAt.$gt instanceof Date);
    assert.equal(result.meta.total, 1);
});


test("notification service returns read records and rejects archived or failed read transitions", async (t) => {
    const orgId = id();
    const userId = id();
    const notificationId = id();
    const readNotification = { status: "read" };
    let currentResult = readNotification;
    t.mock.method(Notification, "findOne", () => query(currentResult));
    const update = t.mock.method(Notification, "findOneAndUpdate", () => query(null));

    assert.equal(await markUserNotificationAsRead({
        orgId,
        userId,
        notificationId
    }), readNotification);
    assert.equal(update.mock.callCount(), 0);

    currentResult = { status: "archived" };
    await assert.rejects(
        () => markUserNotificationAsRead({ orgId, userId, notificationId }),
        (error) => error.statusCode === 400 && /Archived/.test(error.message)
    );

    currentResult = { status: "unread" };
    await assert.rejects(
        () => markUserNotificationAsRead({ orgId, userId, notificationId }),
        (error) => error.statusCode === 409
    );
});


test("notification service delegates read-all and unread count operations", async (t) => {
    const orgId = id();
    const userId = id();
    let updateFilter;
    let countFilter;
    t.mock.method(Notification, "updateMany", async (filter) => {
        updateFilter = filter;
        return { matchedCount: 2, modifiedCount: 2 };
    });
    t.mock.method(Notification, "countDocuments", (filter) => {
        countFilter = filter;
        return query(2);
    });

    assert.deepEqual(await markAllUserNotificationsAsRead({ orgId, userId }), {
        matchedCount: 2,
        modifiedCount: 2
    });
    assert.deepEqual(updateFilter, {
        org: orgId,
        recipient: userId,
        status: "unread"
    });
    assert.equal(await getUnreadNotificationCount({ orgId, userId }), 2);
    assert.deepEqual(countFilter, {
        org: orgId,
        recipient: userId,
        status: "unread"
    });
    await assert.rejects(
        () => getUnreadNotificationCount({ orgId: "bad", userId }),
        (error) => error.statusCode === 400
    );
});
