import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import {
    createOrganizationInvitation,
    acceptOrganizationInvitation,
    revokeOrganizationInvitation,
    listOrganizationInvitations
} from "../../../src/modules/organizationInvitations/organizationInvitation.service.js";

import OrganizationInvitation from "../../../src/modules/organizationInvitations/organizationInvitation.model.js";
import Organization from "../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import User from "../../../src/modules/auth/user.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";

import {
    HTTP_STATUS
} from "../../../src/core/constants/index.js";


const createQuery = (result) => {
    const query = {
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
            return Promise.resolve(result);
        },

        then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
        }
    };

    return query;
};


const createSession = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => { }
});


const createInvitation = (overrides = {}) => {
    const org = new mongoose.Types.ObjectId();
    const invitedBy = new mongoose.Types.ObjectId();

    return {
        _id: new mongoose.Types.ObjectId(),
        org,
        email: "trainer@example.com",
        role: "trainer",
        status: "pending",
        invitedBy,
        expiresAt: new Date(Date.now() + 86400000),
        acceptedBy: null,
        acceptedAt: null,
        revokedBy: null,
        revokedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides
    };
};


const assertInvitationError = async (
    operation,
    statusCode,
    code
) => {
    await assert.rejects(operation, (error) => {
        assert.equal(error.statusCode, statusCode);
        assert.equal(error.code, code);
        return true;
    });
};


test("rejects unsupported invitation roles", async () => {
    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "admin",
            expiresInDays: 7
        }),
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_INVITATION_ROLE"
    );
});


test("rejects invitation expiry below the allowed range", async () => {
    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainer",
            expiresInDays: 0
        }),
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_INVITATION_EXPIRY"
    );
});


test("rejects invitation expiry above the allowed range", async () => {
    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainee",
            expiresInDays: 31
        }),
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_INVITATION_EXPIRY"
    );
});


test("rejects non-integer invitation expiry", async () => {
    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainer",
            expiresInDays: 2.5
        }),
        HTTP_STATUS.BAD_REQUEST,
        "INVALID_INVITATION_EXPIRY"
    );
});


test("rejects an invitation when the token is invalid or already used", async (t) => {
    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async () => null
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery(null)
    );

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "invalid-token",
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.NOT_FOUND,
        "INVITATION_NOT_FOUND"
    );
});


test("marks an expired invitation as expired when acceptance is attempted", async (t) => {
    const invitationId = new mongoose.Types.ObjectId();
    const expiredInvitation = {
        _id: invitationId,
        expiresAt: new Date(Date.now() - 60000)
    };

    let capturedUpdateFilter;
    let capturedUpdate;

    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async () => null
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery(expiredInvitation)
    );

    t.mock.method(
        OrganizationInvitation,
        "updateOne",
        async (filter, update) => {
            capturedUpdateFilter = filter;
            capturedUpdate = update;
            return { modifiedCount: 1 };
        }
    );

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "expired-token",
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.GONE,
        "INVITATION_EXPIRED"
    );

    assert.equal(capturedUpdateFilter._id, invitationId);
    assert.equal(capturedUpdateFilter.status, "pending");
    assert.equal(capturedUpdate.$set.status, "expired");
});


test("revokes a pending invitation and returns its safe representation", async (t) => {
    const invitation = createInvitation();

    let capturedFilter;
    let capturedUpdate;
    let capturedOptions;

    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async (filter, update, options) => {
            capturedFilter = filter;
            capturedUpdate = update;
            capturedOptions = options;
            return {
                ...invitation,
                status: "revoked",
                revokedBy: new mongoose.Types.ObjectId(),
                revokedAt: new Date()
            };
        }
    );

    const result = await revokeOrganizationInvitation({
        invitationId: invitation._id,
        orgId: invitation.org,
        adminId: new mongoose.Types.ObjectId()
    });

    assert.equal(capturedFilter._id, invitation._id);
    assert.equal(capturedFilter.org, invitation.org);
    assert.equal(capturedFilter.status, "pending");
    assert.ok(capturedFilter.expiresAt.$gt);

    assert.equal(capturedUpdate.$set.status, "revoked");
    assert.ok(capturedUpdate.$set.revokedAt);
    assert.equal(capturedOptions.returnDocument, "after");
    assert.equal(capturedOptions.runValidators, true);

    assert.equal(result.id, invitation._id.toString());
    assert.equal(result.orgId, invitation.org.toString());
    assert.equal(result.email, invitation.email);
    assert.equal(result.status, "revoked");
    assert.equal(result.tokenHash, undefined);
});


test("returns not found when revoking an invitation from another organisation", async (t) => {
    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async () => null
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery(null)
    );

    await assertInvitationError(
        () => revokeOrganizationInvitation({
            invitationId: new mongoose.Types.ObjectId(),
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.NOT_FOUND,
        "INVITATION_NOT_FOUND"
    );
});


test("marks an expired pending invitation as expired when revocation is attempted", async (t) => {
    const invitationId = new mongoose.Types.ObjectId();
    const orgId = new mongoose.Types.ObjectId();

    let capturedUpdateFilter;
    let capturedUpdate;

    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async () => null
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery({
            _id: invitationId,
            status: "pending",
            expiresAt: new Date(Date.now() - 60000)
        })
    );

    t.mock.method(
        OrganizationInvitation,
        "updateOne",
        async (filter, update) => {
            capturedUpdateFilter = filter;
            capturedUpdate = update;
            return { modifiedCount: 1 };
        }
    );

    await assertInvitationError(
        () => revokeOrganizationInvitation({
            invitationId,
            orgId,
            adminId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.GONE,
        "INVITATION_EXPIRED"
    );

    assert.equal(capturedUpdateFilter._id, invitationId);
    assert.equal(capturedUpdateFilter.org, orgId);
    assert.equal(capturedUpdate.$set.status, "expired");
});


test("rejects revocation when the invitation is no longer pending", async (t) => {
    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async () => null
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery({
            status: "accepted",
            expiresAt: new Date(Date.now() + 86400000)
        })
    );

    await assertInvitationError(
        () => revokeOrganizationInvitation({
            invitationId: new mongoose.Types.ObjectId(),
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.CONFLICT,
        "INVITATION_NOT_PENDING"
    );
});


test("lists invitations with pagination and optional status filter", async (t) => {
    const orgId = new mongoose.Types.ObjectId();
    const invitation = createInvitation();

    let capturedFilter;
    let capturedUpdateFilter;

    t.mock.method(
        OrganizationInvitation,
        "updateMany",
        async (filter) => {
            capturedUpdateFilter = filter;
            return { modifiedCount: 0 };
        }
    );

    t.mock.method(
        OrganizationInvitation,
        "find",
        (filter) => {
            capturedFilter = filter;
            return createQuery([invitation]);
        }
    );

    t.mock.method(
        OrganizationInvitation,
        "countDocuments",
        async () => 1
    );

    const result = await listOrganizationInvitations({
        orgId,
        page: 2,
        limit: 5,
        status: "pending"
    });

    assert.equal(capturedUpdateFilter.org, orgId);
    assert.equal(capturedUpdateFilter.status, "pending");
    assert.ok(capturedUpdateFilter.expiresAt.$lte);

    assert.equal(capturedFilter.org, orgId);
    assert.equal(capturedFilter.status, "pending");

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, invitation._id.toString());
    assert.equal(result.items[0].tokenHash, undefined);

    assert.deepEqual(result.pagination, {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1
    });
});


test("lists invitations without a status filter", async (t) => {
    const orgId = new mongoose.Types.ObjectId();

    let capturedFilter;

    t.mock.method(
        OrganizationInvitation,
        "updateMany",
        async () => ({ modifiedCount: 0 })
    );

    t.mock.method(
        OrganizationInvitation,
        "find",
        (filter) => {
            capturedFilter = filter;
            return createQuery([]);
        }
    );

    t.mock.method(
        OrganizationInvitation,
        "countDocuments",
        async () => 0
    );

    const result = await listOrganizationInvitations({
        orgId,
        page: 1,
        limit: 10
    });

    assert.deepEqual(capturedFilter, { org: orgId });

    assert.deepEqual(result.pagination, {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    });
});

test("rejects invitation creation when the organisation is unavailable", async (t) => {
    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery(null)
    );

    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainer",
            expiresInDays: 7
        }),
        HTTP_STATUS.NOT_FOUND,
        "ORGANIZATION_NOT_AVAILABLE"
    );
});


test("rejects invitations when the user already has an admin membership", async (t) => {
    const userId = new mongoose.Types.ObjectId();

    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery({
            name: "Ascendra"
        })
    );

    t.mock.method(
        User,
        "findOne",
        () => createQuery({ _id: userId })
    );

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({
            role: "admin",
            status: "approved"
        })
    );

    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "admin@example.com",
            role: "trainer",
            expiresInDays: 7
        }),
        HTTP_STATUS.CONFLICT,
        "ADMIN_MEMBERSHIP_ALREADY_EXISTS"
    );
});


test("rejects invitations when the user already has an approved membership", async (t) => {
    const userId = new mongoose.Types.ObjectId();

    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery({ name: "Ascendra" })
    );

    t.mock.method(
        User,
        "findOne",
        () => createQuery({ _id: userId })
    );

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({
            role: "trainer",
            status: "approved"
        })
    );

    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainer",
            expiresInDays: 7
        }),
        HTTP_STATUS.CONFLICT,
        "MEMBERSHIP_ALREADY_APPROVED"
    );
});


test("rejects invitations when the user's membership is suspended", async (t) => {
    const userId = new mongoose.Types.ObjectId();

    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery({ name: "Ascendra" })
    );

    t.mock.method(
        User,
        "findOne",
        () => createQuery({ _id: userId })
    );

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery({
            role: "trainer",
            status: "suspended"
        })
    );

    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainer",
            expiresInDays: 7
        }),
        HTTP_STATUS.FORBIDDEN,
        "MEMBERSHIP_SUSPENDED"
    );
});


test("rejects invitation creation when another pending invitation exists", async (t) => {
    const orgId = new mongoose.Types.ObjectId();

    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery({ name: "Ascendra" })
    );

    t.mock.method(
        User,
        "findOne",
        () => createQuery(null)
    );

    t.mock.method(
        OrganizationInvitation,
        "updateMany",
        async () => ({ modifiedCount: 0 })
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery({
            _id: new mongoose.Types.ObjectId(),
            expiresAt: new Date(Date.now() + 86400000)
        })
    );

    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId,
            adminId: new mongoose.Types.ObjectId(),
            email: " TRAINER@example.com ",
            role: "trainer",
            expiresInDays: 7
        }),
        HTTP_STATUS.CONFLICT,
        "INVITATION_ALREADY_PENDING"
    );
});


test("converts duplicate-key errors into pending invitation conflicts", async (t) => {
    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery({ name: "Ascendra" })
    );

    t.mock.method(
        User,
        "findOne",
        () => createQuery(null)
    );

    t.mock.method(
        OrganizationInvitation,
        "updateMany",
        async () => ({ modifiedCount: 0 })
    );

    t.mock.method(
        OrganizationInvitation,
        "findOne",
        () => createQuery(null)
    );

    t.mock.method(
        OrganizationInvitation,
        "create",
        async () => {
            const error = new Error("Duplicate key");
            error.code = 11000;
            throw error;
        }
    );

    await assertInvitationError(
        () => createOrganizationInvitation({
            orgId: new mongoose.Types.ObjectId(),
            adminId: new mongoose.Types.ObjectId(),
            email: "trainer@example.com",
            role: "trainer",
            expiresInDays: 7
        }),
        HTTP_STATUS.CONFLICT,
        "INVITATION_ALREADY_PENDING"
    );
});


const createAcceptableInvitation = (overrides = {}) => ({
    ...createInvitation(),
    email: "trainer@example.com",
    role: "trainer",
    invitedBy: new mongoose.Types.ObjectId(),
    ...overrides
});

const mockAcceptanceBase = (
    t,
    {
        invitation = createAcceptableInvitation(),
        user = {
            _id: new mongoose.Types.ObjectId(),
            email: "trainer@example.com"
        },
        organization = {
            _id: invitation.org
        },
        membership = null
    } = {}
) => {
    t.mock.method(
        mongoose,
        "startSession",
        async () => createSession()
    );

    t.mock.method(
        OrganizationInvitation,
        "findOneAndUpdate",
        async () => invitation
    );

    t.mock.method(
        User,
        "findOne",
        () => createQuery(user)
    );

    t.mock.method(
        Organization,
        "findOne",
        () => createQuery(organization)
    );

    t.mock.method(
        OrganizationMembership,
        "findOne",
        () => createQuery(membership)
    );

    return { invitation, user, organization, membership };
};

test("rejects invitation acceptance when the user account is inactive or missing", async (t) => {
    mockAcceptanceBase(t, {
        user: null
    });

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.FORBIDDEN,
        "USER_NOT_ACTIVE"
    );
});

test("rejects invitation acceptance when the user's email does not match", async (t) => {
    mockAcceptanceBase(t, {
        user: {
            _id: new mongoose.Types.ObjectId(),
            email: "different@example.com"
        }
    });

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.FORBIDDEN,
        "INVITATION_EMAIL_MISMATCH"
    );
});

test("rejects invitation acceptance when the organisation is no longer active", async (t) => {
    mockAcceptanceBase(t, {
        organization: null
    });

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId: new mongoose.Types.ObjectId()
        }),
        HTTP_STATUS.FORBIDDEN,
        "ORGANIZATION_NOT_AVAILABLE"
    );
});

test("accepts a trainer invitation by creating a membership and trainer profile", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation();

    const membership = {
        _id: new mongoose.Types.ObjectId(),
        org: invitation.org,
        user: userId,
        role: "trainer",
        status: "approved",
        joinedAt: new Date(),
        approvedBy: invitation.invitedBy,
        approvedAt: new Date()
    };

    let capturedMembershipDocuments;
    let capturedMembershipOptions;
    let capturedProfileFilter;
    let capturedProfileUpdate;
    let capturedProfileOptions;

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        }
    });

    t.mock.method(
        OrganizationMembership,
        "create",
        async (documents, options) => {
            capturedMembershipDocuments = documents;
            capturedMembershipOptions = options;
            return [membership];
        }
    );

    t.mock.method(
        TrainerProfile,
        "updateOne",
        async (filter, update, options) => {
            capturedProfileFilter = filter;
            capturedProfileUpdate = update;
            capturedProfileOptions = options;
            return { upsertedCount: 1 };
        }
    );

    const result = await acceptOrganizationInvitation({
        token: "valid-token",
        userId
    });

    assert.equal(capturedMembershipDocuments.length, 1);
    assert.equal(capturedMembershipDocuments[0].org, invitation.org);
    assert.equal(capturedMembershipDocuments[0].user, userId);
    assert.equal(capturedMembershipDocuments[0].role, "trainer");
    assert.equal(capturedMembershipDocuments[0].status, "approved");
    assert.equal(capturedMembershipDocuments[0].approvedBy, invitation.invitedBy);
    assert.ok(capturedMembershipOptions.session);

    assert.equal(capturedProfileFilter.org, invitation.org);
    assert.equal(capturedProfileFilter.user, userId);
    assert.equal(capturedProfileUpdate.$setOnInsert.org, invitation.org);
    assert.equal(capturedProfileUpdate.$setOnInsert.user, userId);
    assert.equal(capturedProfileOptions.upsert, true);
    assert.ok(capturedProfileOptions.session);
    assert.equal(capturedProfileOptions.setDefaultsOnInsert, true);

    assert.equal(result.id, membership._id.toString());
    assert.equal(result.orgId, invitation.org.toString());
    assert.equal(result.userId, userId.toString());
    assert.equal(result.role, "trainer");
    assert.equal(result.status, "approved");
    assert.equal(result.approvedBy, invitation.invitedBy.toString());
});

test("accepts a trainee invitation without creating a trainer profile", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation({
        role: "trainee"
    });

    const membership = {
        _id: new mongoose.Types.ObjectId(),
        org: invitation.org,
        user: userId,
        role: "trainee",
        status: "approved",
        joinedAt: new Date(),
        approvedBy: invitation.invitedBy,
        approvedAt: new Date()
    };

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        }
    });

    t.mock.method(
        OrganizationMembership,
        "create",
        async () => [membership]
    );

    const profileUpdate = t.mock.method(
        TrainerProfile,
        "updateOne",
        async () => ({ upsertedCount: 1 })
    );

    const result = await acceptOrganizationInvitation({
        token: "valid-token",
        userId
    });

    assert.equal(result.role, "trainee");
    assert.equal(result.status, "approved");
    assert.equal(profileUpdate.mock.callCount(), 0);
});

test("reactivates an existing rejected membership when accepting an invitation", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation();

    let saveCalled = false;

    const membership = {
        _id: new mongoose.Types.ObjectId(),
        org: invitation.org,
        user: userId,
        role: "trainee",
        status: "rejected",
        joinedAt: null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: new mongoose.Types.ObjectId(),
        rejectedAt: new Date(),
        rejectionReason: "Previous application rejected",
        suspendedBy: null,
        suspendedAt: null,
        save: async () => {
            saveCalled = true;
        }
    };

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        },
        membership
    });

    t.mock.method(
        TrainerProfile,
        "updateOne",
        async () => ({ matchedCount: 1 })
    );

    const result = await acceptOrganizationInvitation({
        token: "valid-token",
        userId
    });

    assert.equal(saveCalled, true);
    assert.equal(membership.role, "trainer");
    assert.equal(membership.status, "approved");
    assert.ok(membership.joinedAt);
    assert.equal(membership.approvedBy, invitation.invitedBy);
    assert.ok(membership.approvedAt);

    assert.equal(membership.rejectedBy, null);
    assert.equal(membership.rejectedAt, null);
    assert.equal(membership.rejectionReason, null);
    assert.equal(membership.suspendedBy, null);
    assert.equal(membership.suspendedAt, null);

    assert.equal(result.id, membership._id.toString());
    assert.equal(result.role, "trainer");
    assert.equal(result.status, "approved");
});


test("rejects invitation acceptance by an organisation administrator", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation();

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        },
        membership: {
            role: "admin",
            status: "approved"
        }
    });

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId
        }),
        HTTP_STATUS.CONFLICT,
        "ADMIN_MEMBERSHIP_ALREADY_EXISTS"
    );
});


test("rejects invitation acceptance when membership is already approved", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation();

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        },
        membership: {
            role: "trainer",
            status: "approved"
        }
    });

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId
        }),
        HTTP_STATUS.CONFLICT,
        "MEMBERSHIP_ALREADY_APPROVED"
    );
});


test("rejects invitation acceptance when membership is suspended", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation();

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        },
        membership: {
            role: "trainer",
            status: "suspended"
        }
    });

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId
        }),
        HTTP_STATUS.FORBIDDEN,
        "MEMBERSHIP_SUSPENDED"
    );
});

test("converts duplicate-key errors during invitation acceptance into conflicts", async (t) => {
    const userId = new mongoose.Types.ObjectId();
    const invitation = createAcceptableInvitation();

    mockAcceptanceBase(t, {
        invitation,
        user: {
            _id: userId,
            email: invitation.email
        }
    });

    t.mock.method(
        OrganizationMembership,
        "create",
        async () => {
            const error = new Error("Duplicate membership");
            error.code = 11000;
            throw error;
        }
    );

    await assertInvitationError(
        () => acceptOrganizationInvitation({
            token: "valid-token",
            userId
        }),
        HTTP_STATUS.CONFLICT,
        "INVITATION_ACCEPTANCE_CONFLICT"
    );
});