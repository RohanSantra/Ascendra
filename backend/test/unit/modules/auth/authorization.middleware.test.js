import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import Organization from "../../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import {
    loadOrganizationMembership,
    authorizeRoles,
    authorizePlatformAdmin
} from "../../../../src/modules/auth/authorization.middleware.js";

const createQuery = (result) => ({
    select() {
        return this;
    },
    lean() {
        return Promise.resolve(result);
    },
    then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
    }
});

const runMiddleware = (middleware, request) =>
    new Promise((resolve) => {
        middleware(request, {}, (error) => resolve(error ?? null));
    });

const createRequest = ({
    user = { userId: new mongoose.Types.ObjectId().toString() },
    organizationId = new mongoose.Types.ObjectId().toString()
} = {}) => ({
    user,
    get: (name) =>
        name === "X-Organization-Id" ? organizationId : undefined
});

const mockOrganization = (t, organization) => {
    t.mock.method(
        Organization,
        "findById",
        () => createQuery(organization)
    );
};

const mockMembership = (t, membership) => {
    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery(membership)
    );
};

test("requires an authenticated user and selected organization", async () => {
    const unauthenticatedError = await runMiddleware(
        loadOrganizationMembership,
        createRequest({ user: null })
    );
    const missingOrganizationError = await runMiddleware(
        loadOrganizationMembership,
        createRequest({ organizationId: null })
    );
    const invalidOrganizationError = await runMiddleware(
        loadOrganizationMembership,
        createRequest({ organizationId: "not-an-object-id" })
    );

    assert.equal(unauthenticatedError.code, "AUTH_REQUIRED");
    assert.equal(missingOrganizationError.code, "ORGANIZATION_ID_REQUIRED");
    assert.equal(invalidOrganizationError.code, "INVALID_ORGANIZATION_ID");
});

test("rejects organizations that are missing or inactive", async (t) => {
    const request = createRequest();
    mockOrganization(t, null);

    const missingError = await runMiddleware(
        loadOrganizationMembership,
        request
    );

    assert.equal(missingError.statusCode, 404);
    assert.equal(missingError.code, "ORGANIZATION_NOT_FOUND");
});

test("rejects inactive organizations before checking membership", async (t) => {
    const request = createRequest();
    mockOrganization(t, { _id: request.get("X-Organization-Id"), status: "suspended" });
    let membershipLookupCalled = false;
    t.mock.method(OrganizationMembership, "findOne", () => {
        membershipLookupCalled = true;
        return createQuery(null);
    });

    const error = await runMiddleware(loadOrganizationMembership, request);

    assert.equal(error.statusCode, 403);
    assert.equal(error.code, "ORGANIZATION_NOT_ACTIVE");
    assert.equal(membershipLookupCalled, false);
});

test("rejects missing and unapproved organization memberships", async (t) => {
    const request = createRequest();
    const organization = {
        _id: request.get("X-Organization-Id"),
        status: "active"
    };
    mockOrganization(t, organization);
    mockMembership(t, null);

    const missingError = await runMiddleware(
        loadOrganizationMembership,
        request
    );
    assert.equal(missingError.code, "ORGANIZATION_MEMBERSHIP_REQUIRED");

    for (const [status, code] of [
        ["suspended", "ORGANIZATION_MEMBERSHIP_SUSPENDED"],
        ["rejected", "ORGANIZATION_MEMBERSHIP_REJECTED"],
        ["pending", "ORGANIZATION_MEMBERSHIP_NOT_APPROVED"]
    ]) {
        const scopedRequest = createRequest();
        const scopedOrganization = {
            _id: scopedRequest.get("X-Organization-Id"),
            status: "active"
        };
        mockOrganization(t, scopedOrganization);
        mockMembership(t, {
            _id: new mongoose.Types.ObjectId(),
            status
        });

        const error = await runMiddleware(
            loadOrganizationMembership,
            scopedRequest
        );

        assert.equal(error.statusCode, 403);
        assert.equal(error.code, code);
    }
});

test("attaches approved membership authorization context", async (t) => {
    const request = createRequest();
    const organizationId = request.get("X-Organization-Id");
    const membershipId = new mongoose.Types.ObjectId();

    mockOrganization(t, { _id: organizationId, status: "active" });
    mockMembership(t, {
        _id: membershipId,
        status: "approved",
        role: "trainer"
    });

    const error = await runMiddleware(loadOrganizationMembership, request);

    assert.equal(error, null);
    assert.equal(request.user.orgId, organizationId);
    assert.equal(request.user.membershipId, membershipId.toString());
    assert.equal(request.user.role, "trainer");
});

test("validates organization roles and permits only explicitly allowed roles", () => {
    assert.throws(() => authorizeRoles(), /at least one valid organization role/);
    assert.throws(
        () => authorizeRoles("platform_admin"),
        /at least one valid organization role/
    );

    const missingRoleError = {};
    authorizeRoles("admin")({}, {}, (error) => {
        missingRoleError.error = error;
    });
    assert.equal(
        missingRoleError.error.code,
        "ORGANIZATION_AUTHORIZATION_REQUIRED"
    );

    const insufficientRoleError = {};
    authorizeRoles("admin")(
        { user: { role: "trainee" } },
        {},
        (error) => {
            insufficientRoleError.error = error;
        }
    );
    assert.equal(insufficientRoleError.error.code, "INSUFFICIENT_ROLE");

    let nextCalled = false;
    authorizeRoles("admin", "trainer")(
        { user: { role: "trainer" } },
        {},
        () => {
            nextCalled = true;
        }
    );
    assert.equal(nextCalled, true);
});

test("requires a platform administrator for platform-only operations", () => {
    const unauthenticated = {};
    authorizePlatformAdmin({}, {}, (error) => {
        unauthenticated.error = error;
    });
    assert.equal(unauthenticated.error.code, "AUTH_REQUIRED");

    const notAdmin = {};
    authorizePlatformAdmin(
        { user: { userId: "user-1", platformRole: "user" } },
        {},
        (error) => {
            notAdmin.error = error;
        }
    );
    assert.equal(notAdmin.error.statusCode, 403);
    assert.equal(notAdmin.error.code, "PLATFORM_ADMIN_REQUIRED");

    let nextCalled = false;
    authorizePlatformAdmin(
        { user: { userId: "user-1", platformRole: "platform_admin" } },
        {},
        () => {
            nextCalled = true;
        }
    );
    assert.equal(nextCalled, true);
});
