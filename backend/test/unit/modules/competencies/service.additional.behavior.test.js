import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Competency from "../../../../src/modules/competencies/competency.model.js";
import {
    archiveCompetency,
    createCompetency,
    getCompetencyById,
    listCompetencies,
    updateCompetency
} from "../../../../src/modules/competencies/competency.service.js";

const id = () => new mongoose.Types.ObjectId();

const competencyDocument = (overrides = {}) => ({
    _id: id(),
    org: id(),
    name: "Communication",
    slug: "communication",
    status: "active",
    createdBy: id(),
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-02T00:00:00.000Z"),
    save: async () => {},
    ...overrides
});

const expectAppError = async (promise, statusCode, code) => {
    await assert.rejects(promise, (error) => {
        assert.equal(error.statusCode, statusCode);
        assert.equal(error.code, code);
        return true;
    });
};

test("competency creation rejects invalid slugs and maps database conflicts", async (t) => {
    const orgId = id();
    const adminId = id();
    await expectAppError(
        createCompetency({
            orgId,
            adminId,
            data: { name: "!!!" }
        }),
        400,
        "INVALID_REQUEST"
    );

    const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
    t.mock.method(Competency, "create", async () => { throw duplicate; });
    await expectAppError(
        createCompetency({
            orgId,
            adminId,
            data: { name: "Communication" }
        }),
        409,
        "RESOURCE_ALREADY_EXISTS"
    );

    const unexpected = new Error("database unavailable");
    t.mock.method(Competency, "create", async () => { throw unexpected; });
    await assert.rejects(
        createCompetency({
            orgId,
            adminId,
            data: { name: "Communication" }
        }),
        (error) => error === unexpected
    );
});

test("competency listing applies search, category, status, and pagination filters", async (t) => {
    const orgId = id();
    const competency = competencyDocument({
        description: undefined,
        category: undefined,
        updatedBy: undefined
    });
    let findFilter;
    let countFilter;
    const query = {
        sort(value) {
            assert.deepEqual(value, { name: 1 });
            return this;
        },
        skip(value) {
            assert.equal(value, 2);
            return this;
        },
        limit(value) {
            assert.equal(value, 2);
            return this;
        },
        lean: async () => [competency]
    };
    t.mock.method(Competency, "find", (filter) => {
        findFilter = filter;
        return query;
    });
    t.mock.method(Competency, "countDocuments", async (filter) => {
        countFilter = filter;
        return 5;
    });

    const result = await listCompetencies({
        orgId,
        page: 2,
        limit: 2,
        search: "a+b",
        category: "leadership",
        status: "all"
    });

    assert.deepEqual(findFilter, {
        org: orgId,
        category: "leadership",
        $or: [
            { name: /a\+b/i },
            { description: /a\+b/i },
            { slug: /a\+b/i }
        ]
    });
    assert.deepEqual(countFilter, findFilter);
    assert.equal(result.items[0].description, "");
    assert.equal(result.items[0].category, "");
    assert.equal(result.items[0].updatedBy, null);
    assert.deepEqual(result.pagination, {
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true
    });
});

test("competency retrieval serializes a match and reports a missing resource", async (t) => {
    const orgId = id();
    const competencyId = id();
    const competency = competencyDocument({ _id: competencyId, org: orgId });
    let filter;
    t.mock.method(Competency, "findOne", (value) => {
        filter = value;
        return { lean: async () => competency };
    });

    const result = await getCompetencyById({ competencyId, orgId });
    assert.deepEqual(filter, { _id: competencyId, org: orgId });
    assert.equal(result.id, competencyId.toString());
    assert.equal(result.org, orgId.toString());

    t.mock.method(Competency, "findOne", () => ({
        lean: async () => null
    }));
    await expectAppError(
        getCompetencyById({ competencyId, orgId }),
        404,
        "RESOURCE_NOT_FOUND"
    );
});

test("competency updates persist changed fields, derive slugs, and reject invalid state", async (t) => {
    const orgId = id();
    const competencyId = id();
    const adminId = id();
    const competency = competencyDocument({ _id: competencyId, org: orgId });
    let saves = 0;
    competency.save = async () => { saves += 1; };
    t.mock.method(Competency, "findOne", async () => competency);

    const result = await updateCompetency({
        competencyId,
        orgId,
        adminId,
        data: {
            name: "  Résumé Skills ",
            description: "Updated",
            category: "leadership"
        }
    });

    assert.equal(competency.name, "  Résumé Skills ");
    assert.equal(competency.slug, "resume-skills");
    assert.equal(competency.description, "Updated");
    assert.equal(competency.category, "leadership");
    assert.equal(competency.updatedBy, adminId);
    assert.equal(result.slug, "resume-skills");
    assert.equal(saves, 1);

    t.mock.method(Competency, "findOne", async () => null);
    await expectAppError(
        updateCompetency({ competencyId, orgId, adminId, data: {} }),
        404,
        "RESOURCE_NOT_FOUND"
    );

    t.mock.method(Competency, "findOne", async () =>
        competencyDocument({ status: "archived" })
    );
    await expectAppError(
        updateCompetency({ competencyId, orgId, adminId, data: {} }),
        409,
        "INVALID_REQUEST"
    );

    t.mock.method(Competency, "findOne", async () =>
        competencyDocument()
    );
    await expectAppError(
        updateCompetency({
            competencyId,
            orgId,
            adminId,
            data: { slug: "!!!" }
        }),
        400,
        "INVALID_REQUEST"
    );
});

test("competency updates map duplicate keys and preserve unexpected save errors", async (t) => {
    const orgId = id();
    const competencyId = id();
    const adminId = id();
    const duplicate = Object.assign(new Error("duplicate"), { code: 11000 });
    const competency = competencyDocument({
        _id: competencyId,
        org: orgId,
        save: async () => { throw duplicate; }
    });
    t.mock.method(Competency, "findOne", async () => competency);

    await expectAppError(
        updateCompetency({
            competencyId,
            orgId,
            adminId,
            data: { name: "Another name" }
        }),
        409,
        "RESOURCE_ALREADY_EXISTS"
    );

    const unexpected = new Error("database unavailable");
    const failingCompetency = competencyDocument({
        save: async () => { throw unexpected; }
    });
    t.mock.method(Competency, "findOne", async () => failingCompetency);
    await assert.rejects(
        updateCompetency({ competencyId, orgId, adminId, data: {} }),
        (error) => error === unexpected
    );
});

test("competency archiving persists the transition and rejects missing or archived records", async (t) => {
    const orgId = id();
    const competencyId = id();
    const adminId = id();
    const competency = competencyDocument({ _id: competencyId, org: orgId });
    let saves = 0;
    competency.save = async () => { saves += 1; };
    t.mock.method(Competency, "findOne", async () => competency);

    const result = await archiveCompetency({ competencyId, orgId, adminId });
    assert.equal(competency.status, "archived");
    assert.equal(competency.updatedBy, adminId);
    assert.equal(result.status, "archived");
    assert.equal(saves, 1);

    t.mock.method(Competency, "findOne", async () => null);
    await expectAppError(
        archiveCompetency({ competencyId, orgId, adminId }),
        404,
        "RESOURCE_NOT_FOUND"
    );

    t.mock.method(Competency, "findOne", async () =>
        competencyDocument({ status: "archived" })
    );
    await expectAppError(
        archiveCompetency({ competencyId, orgId, adminId }),
        409,
        "INVALID_REQUEST"
    );
});

test("competency archive save failures propagate unchanged", async (t) => {
    const orgId = id();
    const competencyId = id();
    const adminId = id();
    const failure = new Error("save failed");
    t.mock.method(Competency, "findOne", async () =>
        competencyDocument({ save: async () => { throw failure; } })
    );

    await assert.rejects(
        archiveCompetency({ competencyId, orgId, adminId }),
        (error) => error === failure
    );
});
