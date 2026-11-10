
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import assertOrganizationReferences from "../../../../src/core/utils/organizationReferences.js";


const createModel = (documents = []) => {
    let capturedFilter;
    let capturedSession;

    const query = {
        select() {
            return this;
        },

        lean() {
            return this;
        },

        session(session) {
            capturedSession = session;
            return this;
        },

        async exec() {
            return documents;
        }
    };

    return {
        model: {
            find(filter) {
                capturedFilter = filter;
                return query;
            }
        },

        getFilter: () => capturedFilter,
        getSession: () => capturedSession
    };
};


const createObjectId = () => new mongoose.Types.ObjectId();


test("returns an empty array when references are omitted", async () => {
    const { model } = createModel();

    const result = await assertOrganizationReferences({
        model,
        ids: [],
        organizationId: createObjectId()
    });

    assert.deepEqual(result, []);
});


test("allows empty references by default", async () => {
    const { model } = createModel();

    const result = await assertOrganizationReferences({
        model,
        ids: null,
        organizationId: createObjectId()
    });

    assert.deepEqual(result, []);
});


test("rejects empty references when allowEmpty is false", async () => {
    const { model } = createModel();

    await assert.rejects(
        assertOrganizationReferences({
            model,
            ids: [],
            organizationId: createObjectId(),
            allowEmpty: false,
            resourceName: "Competency"
        }),
        error =>
            error.statusCode === 400 &&
            error.message === "Competency reference is required."
    );
});


test("validates and returns a single reference", async () => {
    const id = createObjectId();
    const organizationId = createObjectId();

    const { model } = createModel([
        { _id: id }
    ]);

    const result = await assertOrganizationReferences({
        model,
        ids: id,
        organizationId
    });

    assert.deepEqual(result, [id]);
});


test("validates multiple references", async () => {
    const ids = [
        createObjectId(),
        createObjectId(),
        createObjectId()
    ];

    const { model } = createModel(
        ids.map(_id => ({ _id }))
    );

    const result = await assertOrganizationReferences({
        model,
        ids,
        organizationId: createObjectId()
    });

    assert.deepEqual(
        result.map(id => id.toString()),
        ids.map(id => id.toString())
    );
});


test("removes duplicate references", async () => {
    const id = createObjectId();

    const { model, getFilter } = createModel([
        { _id: id }
    ]);

    const result = await assertOrganizationReferences({
        model,
        ids: [id, id.toString(), id],
        organizationId: createObjectId()
    });

    assert.equal(result.length, 1);
    assert.equal(
        getFilter()._id.$in.length,
        1
    );
});


test("supports populated reference objects", async () => {
    const id = createObjectId();

    const { model } = createModel([
        { _id: id }
    ]);

    const result = await assertOrganizationReferences({
        model,
        ids: [{ _id: id }],
        organizationId: createObjectId()
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].toString(), id.toString());
});


test("supports a custom reference field", async () => {
    const userId = createObjectId();
    const organizationId = createObjectId();

    const { model, getFilter } = createModel([
        { user: userId }
    ]);

    const result = await assertOrganizationReferences({
        model,
        ids: userId,
        organizationId,
        referenceField: "user"
    });

    assert.equal(result.length, 1);
    assert.deepEqual(
        getFilter().user.$in,
        [userId]
    );
});


test("supports a custom organization field", async () => {
    const id = createObjectId();
    const organizationId = createObjectId();

    const { model, getFilter } = createModel([
        { _id: id }
    ]);

    await assertOrganizationReferences({
        model,
        ids: id,
        organizationId,
        organizationField: "organization"
    });

    assert.equal(
        getFilter().organization.toString(),
        organizationId.toString()
    );
});


test("passes an optional MongoDB session to the query", async () => {
    const id = createObjectId();
    const session = { testSession: true };

    const { model, getSession } = createModel([
        { _id: id }
    ]);

    await assertOrganizationReferences({
        model,
        ids: id,
        organizationId: createObjectId(),
        session
    });

    assert.equal(getSession(), session);
});


test("rejects an invalid model", async () => {
    await assert.rejects(
        assertOrganizationReferences({
            model: {},
            ids: createObjectId(),
            organizationId: createObjectId()
        }),
        TypeError
    );
});


test("rejects invalid reference field names", async () => {
    const { model } = createModel();

    for (const referenceField of [
        "",
        " ",
        "user.profile"
    ]) {
        await assert.rejects(
            assertOrganizationReferences({
                model,
                ids: createObjectId(),
                organizationId: createObjectId(),
                referenceField
            }),
            TypeError
        );
    }
});


test("rejects invalid organization field names", async () => {
    const { model } = createModel();

    for (const organizationField of [
        "",
        " ",
        "organization.owner"
    ]) {
        await assert.rejects(
            assertOrganizationReferences({
                model,
                ids: createObjectId(),
                organizationId: createObjectId(),
                organizationField
            }),
            TypeError
        );
    }
});


test("rejects an invalid organization ID", async () => {
    const { model } = createModel();

    await assert.rejects(
        assertOrganizationReferences({
            model,
            ids: createObjectId(),
            organizationId: "invalid-id"
        }),
        TypeError
    );
});


test("rejects invalid reference IDs", async () => {
    const { model } = createModel();

    await assert.rejects(
        assertOrganizationReferences({
            model,
            ids: ["invalid-id"],
            organizationId: createObjectId()
        }),
        error =>
            error.statusCode === 400 &&
            error.message.includes("invalid reference ID")
    );
});


test("rejects references that do not belong to the organization", async () => {
    const requestedId = createObjectId();
    const anotherId = createObjectId();

    const { model } = createModel([
        { _id: anotherId }
    ]);

    await assert.rejects(
        assertOrganizationReferences({
            model,
            ids: requestedId,
            organizationId: createObjectId(),
            resourceName: "Competency"
        }),
        error =>
            error.statusCode === 404 &&
            error.message.includes("competency")
    );
});


test("rejects when only some references belong to the organization", async () => {
    const validId = createObjectId();
    const invalidId = createObjectId();

    const { model } = createModel([
        { _id: validId }
    ]);

    await assert.rejects(
        assertOrganizationReferences({
            model,
            ids: [validId, invalidId],
            organizationId: createObjectId()
        }),
        error => error.statusCode === 404
    );
});
