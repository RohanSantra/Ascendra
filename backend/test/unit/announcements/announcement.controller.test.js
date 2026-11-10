import test from "node:test";
import assert from "node:assert/strict";

import {
    createAnnouncementController,
    getAnnouncementController,
    listAnnouncementsController,
    updateAnnouncementController,
    publishAnnouncementController,
    archiveAnnouncementController
} from "../../../src/modules/announcements/announcement.controller.js";

import Announcement from "../../../src/modules/announcements/announcement.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";


const invoke = (handler, req) => new Promise((resolve) => {
    const res = {
        status(statusCode) {
            this.statusCode = statusCode;
            return this;
        },

        json(body) {
            resolve({ statusCode: this.statusCode, body });
            return this;
        }
    };

    handler(req, res, (error) => resolve({ error }));
});


const createQuery = (result) => ({
    session() { return this; },
    select() { return this; },
    populate() { return this; },
    lean() { return Promise.resolve(result); }
});


test("returns successful responses for announcement lifecycle handlers", async (t) => {
    const orgId = "507f1f77bcf86cd799439011";
    const userId = "507f1f77bcf86cd799439012";
    const announcementId = "507f1f77bcf86cd799439013";
    let announcement = {
        _id: announcementId,
        status: "draft",
        title: "Course update",
        message: "New content",
        audience: "everyone"
    };

    t.mock.method(Announcement, "create", async (documents) => [
        { ...documents[0], _id: announcementId }
    ]);
    t.mock.method(
        Announcement,
        "findOne",
        () => createQuery(announcement)
    );
    t.mock.method(
        Announcement,
        "findOneAndUpdate",
        (filter, update) => {
            announcement = {
                ...announcement,
                ...update.$set
            };
            return createQuery(announcement);
        }
    );
    t.mock.method(
        OrganizationMembership,
        "find",
        () => createQuery([])
    );

    const req = {
        user: { orgId, userId },
        organizationMembership: { role: "admin" },
        validated: {
            params: { announcementId },
            body: {
                title: "Course update",
                message: "New content",
                audience: "everyone"
            },
            query: {
                status: undefined,
                audience: undefined,
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        }
    };

    const created = await invoke(createAnnouncementController, req);
    const retrieved = await invoke(getAnnouncementController, req);
    const updated = await invoke(updateAnnouncementController, {
        ...req,
        validated: {
            ...req.validated,
            body: { title: "Revised update" }
        }
    });
    const published = await invoke(publishAnnouncementController, req);
    const archived = await invoke(archiveAnnouncementController, req);

    for (const result of [created, retrieved, updated, published, archived]) {
        assert.equal(result.body.success, true);
    }

    assert.equal(created.statusCode, 201);
    for (const result of [retrieved, updated, published, archived]) {
        assert.equal(result.statusCode, 200);
    }
    assert.equal(retrieved.body.data.status, "draft");
    assert.equal(updated.body.data.title, "Revised update");
    assert.equal(published.body.data.status, "published");
    assert.equal(archived.body.data.status, "archived");
});


test("returns paginated announcements from the list handler", async (t) => {
    const announcements = [{ title: "Course update" }];
    const query = {
        populate() { return this; },
        sort() { return this; },
        skip() { return this; },
        limit() { return this; },
        lean() { return Promise.resolve(announcements); }
    };

    t.mock.method(Announcement, "find", () => query);
    t.mock.method(Announcement, "countDocuments", async () => 1);

    const result = await invoke(listAnnouncementsController, {
        user: { orgId: "507f1f77bcf86cd799439011" },
        organizationMembership: { role: "admin" },
        validated: {
            query: {
                status: undefined,
                audience: undefined,
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        }
    });

    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body.data, announcements);
    assert.deepEqual(result.body.meta, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1
    });
});


test("forwards invalid-reference errors from announcement handlers", async () => {
    const request = {
        user: { orgId: "invalid", userId: "invalid" },
        organizationMembership: { role: "admin" },
        validated: {
            params: { announcementId: "invalid" },
            body: { title: "Title", message: "Message" },
            query: {
                status: undefined,
                audience: undefined,
                page: 1,
                limit: 20,
                sortBy: "createdAt",
                sortOrder: "desc"
            }
        }
    };

    const results = await Promise.all([
        invoke(createAnnouncementController, request),
        invoke(getAnnouncementController, request),
        invoke(updateAnnouncementController, request),
        invoke(publishAnnouncementController, request),
        invoke(archiveAnnouncementController, request)
    ]);

    for (const result of results) {
        assert.ok(result.error);
        assert.equal(result.error.statusCode, 400);
    }
});
