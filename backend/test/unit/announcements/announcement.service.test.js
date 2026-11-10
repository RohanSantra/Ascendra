import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    createOrganizationAnnouncement,
    getOrganizationAnnouncement,
    listOrganizationAnnouncements,
    editOrganizationAnnouncement,
    publishOrganizationAnnouncement,
    archiveOrganizationAnnouncement
} from "../../../src/modules/announcements/announcement.service.js";

import Announcement from "../../../src/modules/announcements/announcement.model.js";

import {
    createAnnouncementSchema,
    listAnnouncementsQuerySchema,
    updateAnnouncementSchema
} from "../../../src/modules/announcements/announcement.validation.js";

import {
    ERROR_CODES,
    HTTP_STATUS
} from "../../../src/core/constants/index.js";

import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";


const createQuery = (result) => ({
    session() {
        return this;
    },

    select() {
        return this;
    },

    populate() {
        return this;
    },

    lean() {
        return Promise.resolve(result);
    }
});


test("creates announcements as drafts with the default audience", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    let capturedData;

    const createdAnnouncement = { _id: new mongoose.Types.ObjectId() };

    t.mock.method(Announcement, "create", async (documents) => {
        capturedData = documents[0];
        return [createdAnnouncement];
    });

    const result = await createOrganizationAnnouncement({
        orgId,
        userId,
        title: "Course update",
        message: "The course schedule has changed."
    });

    assert.equal(result, createdAnnouncement);
    assert.deepEqual(capturedData, {
        org: orgId,
        title: "Course update",
        message: "The course schedule has changed.",
        audience: "everyone",
        status: "draft",
        createdBy: userId
    });
});


test("restricts trainee announcement listings to published trainee audiences", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    let capturedFilter;

    const query = {
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

        lean() {
            return Promise.resolve([]);
        }
    };

    t.mock.method(Announcement, "find", (filter) => {
        capturedFilter = filter;
        return query;
    });
    t.mock.method(Announcement, "countDocuments", async () => 0);

    await listOrganizationAnnouncements({
        orgId,
        role: "trainee",
        filters: {
            status: "draft",
            audience: "trainers"
        }
    });

    assert.deepEqual(capturedFilter, {
        org: orgId,
        status: "published",
        audience: { $in: ["everyone", "trainees"] }
    });
});


test("does not reveal draft announcements to trainees", async (t) => {
    t.mock.method(
        Announcement,
        "findOne",
        () => createQuery({
            status: "draft",
            audience: "everyone"
        })
    );

    await assert.rejects(
        () => getOrganizationAnnouncement({
            orgId: new mongoose.Types.ObjectId(),
            announcementId: new mongoose.Types.ObjectId(),
            role: "trainee"
        }),
        (error) => {
            assert.equal(error.statusCode, HTTP_STATUS.NOT_FOUND);
            assert.equal(error.code, ERROR_CODES.RESOURCE_NOT_FOUND);
            return true;
        }
    );
});


test("edits draft announcements while recording the updater", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const announcementId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const updated = { title: "Revised title" };
    let updateCall;

    t.mock.method(
        Announcement,
        "findOne",
        () => createQuery({ status: "draft" })
    );
    t.mock.method(
        Announcement,
        "findOneAndUpdate",
        (filter, update) => {
            updateCall = { filter, update };
            return createQuery(updated);
        }
    );

    assert.equal(
        await editOrganizationAnnouncement({
            orgId,
            announcementId,
            userId,
            updates: { title: "Revised title" }
        }),
        updated
    );
    assert.deepEqual(updateCall, {
        filter: { _id: announcementId, org: orgId },
        update: {
            $set: {
                title: "Revised title",
                updatedBy: userId
            }
        }
    });
});


test("publishes drafts and archives announcements", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const announcementId = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    const published = {
        status: "published",
        title: "Course update",
        message: "New content",
        audience: "trainees"
    };
    const updates = [];

    t.mock.method(Announcement, "findOne", () => {
        const status = updates.length === 0 ? "draft" : "published";
        return createQuery({ status });
    });
    t.mock.method(
        OrganizationMembership,
        "find",
        () => createQuery([])
    );
    t.mock.method(
        Announcement,
        "findOneAndUpdate",
        (filter, update) => {
            updates.push({ filter, update });
            return createQuery(
                updates.length === 1
                    ? published
                    : { status: "archived" }
            );
        }
    );

    const result = await publishOrganizationAnnouncement({
        orgId,
        announcementId,
        userId
    });

    assert.equal(result, published);
    assert.deepEqual(updates[0].filter, {
        _id: announcementId,
        org: orgId
    });
    assert.equal(updates[0].update.$set.status, "published");
    assert.ok(updates[0].update.$set.publishedAt instanceof Date);
    assert.equal(updates[0].update.$set.updatedBy, userId);

    const archived = await archiveOrganizationAnnouncement({
        orgId,
        announcementId,
        userId
    });

    assert.deepEqual(archived, { status: "archived" });
    assert.deepEqual(updates[1].update, {
        $set: {
            status: "archived",
            updatedBy: userId
        }
    });
});


test("rejects edits to published announcements without updating them", async (t) => {
    t.mock.method(
        Announcement,
        "findOne",
        () => createQuery({ status: "published" })
    );
    const updateMock = t.mock.method(
        Announcement,
        "findOneAndUpdate",
        () => createQuery({})
    );

    await assert.rejects(
        () => editOrganizationAnnouncement({
            orgId: new mongoose.Types.ObjectId(),
            announcementId: new mongoose.Types.ObjectId(),
            userId: new mongoose.Types.ObjectId(),
            updates: { title: "Updated" }
        }),
        { code: ERROR_CODES.RESOURCE_CONFLICT }
    );
    assert.equal(updateMock.mock.callCount(), 0);
});


test("applies creation and listing validation defaults and rejects empty edits", () => {
    const creation = createAnnouncementSchema.parse({
        body: {
            title: "  Course update  ",
            message: "  New material is available.  "
        }
    });

    assert.equal(creation.body.title, "Course update");
    assert.equal(creation.body.audience, "everyone");

    assert.deepEqual(
        listAnnouncementsQuerySchema.parse({ query: {} }).query,
        {
            page: 1,
            limit: 20,
            sortBy: "createdAt",
            sortOrder: "desc"
        }
    );

    assert.equal(
        updateAnnouncementSchema.safeParse({
            params: {
                announcementId: "507f1f77bcf86cd799439011"
            },
            body: {}
        }).success,
        false
    );
});
