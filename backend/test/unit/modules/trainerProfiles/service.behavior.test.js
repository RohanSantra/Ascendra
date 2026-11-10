import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import OrganizationMembership from "../../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../../src/modules/trainerProfiles/trainerProfile.model.js";
import {
    updateMyTrainerProfessionalDetails
} from "../../../../src/modules/trainerProfiles/trainerProfile.service.js";
import {
    getMyTrainerProfile,
    updateMyTrainerAvailability
} from "../../../../src/modules/trainerProfiles/trainerProfile.service.js";
import {
    approveTrainerEligibility
} from "../../../../src/modules/trainerProfiles/trainerApproval.service.js";
import {
    listPendingTrainerApprovals,
    rejectTrainerEligibility,
    suspendTrainerEligibility
} from "../../../../src/modules/trainerProfiles/trainerApproval.service.js";

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


const createSession = () => ({
    withTransaction: async (callback) => callback(),
    endSession: async () => {}
});


test("trainer profile service updates only professional fields and saves", async (t) => {
    const orgId = id();
    const userId = id();
    const profile = {
        _id: id(),
        org: orgId,
        user: userId,
        professionalDetails: { headline: "Old title", bio: "Old bio" },
        approval: { status: "pending" },
        availability: { activeTrainings: 1 },
        save: async () => {}
    };
    let saved = false;
    profile.save = async () => {
        saved = true;
        return profile;
    };
    t.mock.method(TrainerProfile, "findOne", () => createQuery(profile));

    const result = await updateMyTrainerProfessionalDetails({
        orgId,
        userId,
        data: { headline: "New title", status: "approved" }
    });

    assert.equal(saved, true);
    assert.deepEqual(profile.professionalDetails, {
        headline: "New title",
        bio: "Old bio"
    });
    assert.equal(profile.approval.status, "pending");
    assert.equal(result.id, profile._id.toString());
    assert.equal(result.professionalDetails.headline, "New title");
});


test("trainer approval requires an approved membership and records the reviewer", async (t) => {
    const profileId = id();
    const orgId = id();
    const adminId = id();
    const trainerId = id();
    const profile = {
        _id: profileId,
        org: orgId,
        user: trainerId,
        professionalDetails: {},
        approval: { status: "pending" },
        evidenceStats: {},
        experience: {},
        completion: {},
        save: async () => {}
    };
    let membershipFilter;
    let profileSaved = false;
    t.mock.method(mongoose, "startSession", async () => createSession());
    t.mock.method(TrainerProfile, "findOne", () => createQuery(profile));
    t.mock.method(OrganizationMembership, "findOne", (filter) => {
        membershipFilter = filter;
        return createQuery({ _id: id() });
    });
    profile.save = async () => {
        profileSaved = true;
    };

    const result = await approveTrainerEligibility({ profileId, orgId, adminId });

    assert.deepEqual(membershipFilter, {
        org: orgId,
        user: trainerId,
        role: "trainer",
        status: "approved"
    });
    assert.equal(profileSaved, true);
    assert.equal(profile.approval.status, "approved");
    assert.equal(profile.approval.reviewedBy, adminId);
    assert.equal(result.approval.status, "approved");
});

test("pending approval service filters profiles by approved trainer membership", async (t) => {
    const orgId = id();
    const trainerId = id();
    const profile = {
        _id: id(), org: orgId,
        user: { _id: trainerId, firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
        professionalDetails: {}, approval: { status: "pending" },
        evidenceStats: {}, experience: {}, completion: {}
    };
    t.mock.method(OrganizationMembership, "find", (filter) => {
        assert.deepEqual(filter, { org: orgId, role: "trainer", status: "approved" });
        return createQuery([{ user: trainerId }]);
    });
    t.mock.method(TrainerProfile, "find", (filter) => {
        assert.deepEqual(filter, {
            org: orgId, user: { $in: [trainerId] }, "approval.status": "pending"
        });
        return createQuery([profile]);
    });
    t.mock.method(TrainerProfile, "countDocuments", async () => 3);

    const result = await listPendingTrainerApprovals({ orgId, page: 2, limit: 2 });
    assert.equal(result.items[0].user.email, "ada@example.test");
    assert.equal(result.items[0].approval.status, "pending");
    assert.deepEqual(result.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
});

test("trainer approval service rejects pending eligibility and suspends approved membership", async (t) => {
    const orgId = id();
    const adminId = id();
    const trainerId = id();
    const profileId = id();
    const profile = {
        _id: profileId, org: orgId, user: trainerId,
        professionalDetails: {}, approval: { status: "pending" },
        evidenceStats: {}, experience: {}, completion: {}, save: async () => {}
    };
    const membership = { _id: id(), status: "approved", save: async () => {} };
    t.mock.method(mongoose, "startSession", async () => createSession());
    t.mock.method(TrainerProfile, "findOne", () => createQuery(profile));
    t.mock.method(OrganizationMembership, "findOne", () => createQuery(membership));

    const rejected = await rejectTrainerEligibility({
        profileId, orgId, adminId, reason: "Missing qualifications"
    });
    assert.equal(rejected.approval.status, "rejected");
    assert.equal(rejected.approval.rejectionReason, "Missing qualifications");
    assert.equal(rejected.approval.reviewedBy, adminId.toString());

    profile.approval.status = "approved";
    const suspended = await suspendTrainerEligibility({
        profileId, orgId, adminId, reason: "Policy review"
    });
    assert.equal(suspended.approval.status, "suspended");
    assert.equal(suspended.approval.suspensionReason, "Policy review");
    assert.equal(membership.status, "suspended");
    assert.equal(membership.suspendedBy, adminId);
});

test("trainer approval service rejects missing profiles, memberships, and invalid states", async (t) => {
    const orgId = id();
    const profileId = id();
    const adminId = id();
    t.mock.method(mongoose, "startSession", async () => createSession());

    let profileResult = null;
    let membershipCall = 0;
    let membershipMode = "available";
    t.mock.method(TrainerProfile, "findOne", () => createQuery(profileResult));
    t.mock.method(OrganizationMembership, "findOne", () => {
        membershipCall += 1;
        const missing = membershipMode === "none"
            || (membershipMode === "secondaryMissing" && membershipCall === 2);
        return createQuery(missing ? null : { _id: id() });
    });
    await assert.rejects(
        () => approveTrainerEligibility({ profileId, orgId, adminId }),
        (error) => error.statusCode === 404 && error.code === "TRAINER_PROFILE_NOT_FOUND"
    );

    const profile = {
        _id: profileId, org: orgId, user: id(),
        approval: { status: "pending" }, save: async () => {}
    };
    profileResult = profile;
    membershipCall = 0;
    membershipMode = "none";
    await assert.rejects(
        () => approveTrainerEligibility({ profileId, orgId, adminId }),
        (error) => error.statusCode === 409 && error.code === "TRAINER_MEMBERSHIP_NOT_APPROVED"
    );

    membershipCall = 0;
    membershipMode = "available";
    profile.approval.status = "rejected";
    await assert.rejects(
        () => approveTrainerEligibility({ profileId, orgId, adminId }),
        (error) => error.code === "TRAINER_APPROVAL_INVALID_STATUS"
    );
    await assert.rejects(
        () => rejectTrainerEligibility({ profileId, orgId, adminId, reason: "No" }),
        (error) => error.code === "TRAINER_APPROVAL_INVALID_STATUS"
    );
    profile.approval.status = "pending";
    membershipCall = 0;
    membershipMode = "available";
    await assert.rejects(
        () => suspendTrainerEligibility({ profileId, orgId, adminId, reason: "Hold" }),
        (error) => error.code === "TRAINER_APPROVAL_INVALID_STATUS"
    );
    profile.approval.status = "approved";
    membershipCall = 0;
    membershipMode = "secondaryMissing";
    await assert.rejects(
        () => suspendTrainerEligibility({ profileId, orgId, adminId, reason: "Hold" }),
        (error) => error.code === "TRAINER_MEMBERSHIP_NOT_APPROVED"
    );
});

test("trainer profile service returns own profile and protects active capacity", async (t) => {
    const orgId = id();
    const userId = id();
    const profile = {
        _id: id(), org: orgId, user: userId,
        professionalDetails: {}, approval: { status: "approved" },
        competencySummary: [], skills: [], evidenceStats: {}, experience: {},
        availability: { activeTrainings: 2, maxConcurrentTrainings: 3 },
        completion: {}
    };
    t.mock.method(TrainerProfile, "findOne", () => createQuery(profile));

    const result = await getMyTrainerProfile({ orgId, userId });
    assert.equal(result.id, profile._id.toString());
    assert.equal(result.userId, userId.toString());
    await assert.rejects(
        () => updateMyTrainerAvailability({
            orgId, userId, data: { maxConcurrentTrainings: 1 }
        }),
        (error) => error.statusCode === 409
            && error.code === "TRAINER_CAPACITY_BELOW_ACTIVE_COUNT"
    );
});

test("trainer profile service rejects a profile outside the authenticated organization", async (t) => {
    t.mock.method(TrainerProfile, "findOne", () => createQuery(null));
    await assert.rejects(
        () => getMyTrainerProfile({ orgId: id(), userId: id() }),
        (error) => error.statusCode === 404 && error.code === "TRAINER_PROFILE_NOT_FOUND"
    );
});
