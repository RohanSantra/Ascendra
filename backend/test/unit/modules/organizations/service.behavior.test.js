import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import Organization from "../../../../src/modules/organizations/organization.model.js";
import {
    listDiscoverableOrganizations
} from "../../../../src/modules/organizations/organization.service.js";

const id = () => new mongoose.Types.ObjectId();


const createQuery = (result) => ({
    select() {
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

    populate() {
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
});


test("organization discovery scopes active results, escapes search, and paginates", async (t) => {
    const orgId = id();
    const organizations = [{ _id: orgId, name: "Alpha" }];
    let capturedFilter;
    let capturedSkip;
    let capturedLimit;

    t.mock.method(Organization, "find", (filter) => {
        capturedFilter = filter;
        const query = createQuery(organizations);
        const skip = query.skip;
        const limit = query.limit;
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
    t.mock.method(Organization, "countDocuments", () => Promise.resolve(7));

    const result = await listDiscoverableOrganizations({
        page: 2,
        limit: 3,
        search: "A.*"
    });

    assert.equal(capturedFilter.status, "active");
    assert.equal(capturedFilter.$or[0].name.$regex, "A\\.\\*");
    assert.equal(capturedFilter.$or[1].slug.$regex, "A\\.\\*");
    assert.equal(capturedSkip, 3);
    assert.equal(capturedLimit, 3);
    assert.deepEqual(result, {
        organizations,
        pagination: { page: 2, limit: 3, total: 7, totalPages: 3 }
    });
});
