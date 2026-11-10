import test, {
    before,
    after,
    beforeEach
} from "node:test";

import assert from "node:assert/strict";

import {
    startTestDatabase,
    clearTestDatabase,
    stopTestDatabase
} from "../../helpers/database.js";

import User from "../../../src/modules/auth/user.model.js";
import Organization from "../../../src/modules/organizations/organization.model.js";
import OrganizationMembership from "../../../src/modules/organizationMemberships/organizationMembership.model.js";
import TrainerProfile from "../../../src/modules/trainerProfiles/trainerProfile.model.js";
import Competency from "../../../src/modules/competencies/competency.model.js";
import Skill from "../../../src/modules/skills/skill.model.js";
import CompetencyEvidence from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.model.js";

import {
    createEvidence,
    deleteMyEvidence
} from "../../../src/modules/competencyEvidence/submissions/competencyEvidence.service.js";

import {
    approveEvidence,
    rejectEvidence,
    listPendingEvidence,
    getPendingEvidenceById
} from "../../../src/modules/competencyEvidence/verification/evidenceVerification.service.js";

let organization;
let trainer;
let trainerProfile;
let competency;
let skill;

before(async () => {
    await startTestDatabase();
});

after(async () => {
    await stopTestDatabase();
});

beforeEach(async () => {
    await clearTestDatabase();

    trainer = await User.create({
        firstName: "Test",
        lastName: "Trainer",
        email: "trainer@example.com"
    });

    organization = await Organization.create({
        name: "Test Organization",
        slug: "test-organization",
        createdBy: trainer._id
    });

    await OrganizationMembership.create({
        org: organization._id,
        user: trainer._id,
        role: "trainer",
        status: "approved",
        joinedAt: new Date()
    });

    trainerProfile = await TrainerProfile.create({
        org: organization._id,
        user: trainer._id,
        approval: {
            status: "approved"
        }
    });

    competency = await Competency.create({
        org: organization._id,
        name: "Software Development",
        slug: "software-development",
        status: "active",
        createdBy: trainer._id
    });

    skill = await Skill.create({
        org: organization._id,
        name: "JavaScript",
        slug: "javascript",
        competencies: [competency._id],
        status: "active",
        createdBy: trainer._id
    });
});

/**
 * Creates qualification evidence for the current test trainer.
 */
const submitQualificationEvidence = async ({
    title = "Bachelor of Computer Science",
    description = "Undergraduate qualification",
    competencies = [competency._id.toString()],
    skills = [skill._id.toString()]
} = {}) => {
    return createEvidence({
        orgId: organization._id,
        userId: trainer._id,
        data: {
            type: "qualification",
            competencies,
            skills,
            title,
            description,
            details: {
                qualificationName: title,
                institution: "Example University",
                fieldOfStudy: "Computer Science"
            }
        }
    });
};

/**
 * Creates an administrator for verification tests.
 */
const createTestAdmin = async (email = "admin@example.com") => {
    return User.create({
        firstName: "Test",
        lastName: "Admin",
        email
    });
};

/* -------------------------------------------------------------------------- */
/* Evidence submission                                                        */
/* -------------------------------------------------------------------------- */

test(
    "creates qualification evidence and recomputes the trainer profile",
    async () => {
        const result = await createEvidence({
            orgId: organization._id,
            userId: trainer._id,
            data: {
                type: "qualification",
                competencies: [competency._id.toString()],
                skills: [skill._id.toString()],
                title: "Bachelor of Computer Science",
                description: "Undergraduate qualification",
                details: {
                    qualificationName: "Bachelor of Computer Science",
                    institution: "Example University",
                    fieldOfStudy: "Computer Science"
                }
            }
        });

        assert.ok(result.id);
        assert.equal(result.type, "qualification");
        assert.equal(result.title, "Bachelor of Computer Science");
        assert.equal(result.verification.status, "self_reported");
        assert.equal(result.isDeleted, false);

        assert.deepEqual(
            result.competencies,
            [competency._id.toString()]
        );

        assert.deepEqual(
            result.skills,
            [skill._id.toString()]
        );

        const savedEvidence = await CompetencyEvidence.findById(
            result.id
        ).lean();

        assert.ok(savedEvidence);

        assert.equal(
            savedEvidence.org.toString(),
            organization._id.toString()
        );

        assert.equal(
            savedEvidence.user.toString(),
            trainer._id.toString()
        );

        assert.equal(
            savedEvidence.trainerProfile.toString(),
            trainerProfile._id.toString()
        );

        assert.equal(
            savedEvidence.verification.status,
            "self_reported"
        );

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.ok(updatedProfile);

        assert.equal(updatedProfile.evidenceStats.total, 1);
        assert.equal(updatedProfile.evidenceStats.verified, 0);
        assert.equal(updatedProfile.evidenceStats.verifiedRatio, 0);

        assert.ok(
            updatedProfile.competencyRecomputedAt instanceof Date
        );

        const competencySummary =
            updatedProfile.competencySummary.find(
                (item) =>
                    item.competency.toString() ===
                    competency._id.toString()
            );

        assert.ok(
            competencySummary,
            "Expected the trainer competency summary to contain the competency"
        );

        assert.equal(competencySummary.evidenceCount, 1);
        assert.equal(competencySummary.verifiedEvidenceCount, 0);

        assert.ok(
            competencySummary.points > 0,
            "Expected qualification evidence to contribute competency points"
        );

        const skillSummary = updatedProfile.skills.find(
            (item) =>
                item.skill.toString() === skill._id.toString()
        );

        assert.ok(
            skillSummary,
            "Expected the trainer skill summary to contain the skill"
        );

        assert.equal(skillSummary.evidenceCount, 1);
        assert.equal(skillSummary.verified, false);

        const evidenceCount = await CompetencyEvidence.countDocuments({
            org: organization._id,
            user: trainer._id
        });

        assert.equal(evidenceCount, 1);
    }
);

test(
    "rolls back evidence creation when trainer profile recomputation fails",
    async () => {
        const originalProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        const originalSave = TrainerProfile.prototype.save;

        try {
            TrainerProfile.prototype.save = async function () {
                throw new Error(
                    "Simulated trainer profile persistence failure"
                );
            };

            await assert.rejects(
                createEvidence({
                    orgId: organization._id,
                    userId: trainer._id,
                    data: {
                        type: "qualification",
                        competencies: [competency._id.toString()],
                        skills: [skill._id.toString()],
                        title: "Bachelor of Computer Science",
                        description: "Undergraduate qualification",
                        details: {
                            qualificationName: "Bachelor of Computer Science",
                            institution: "Example University",
                            fieldOfStudy: "Computer Science"
                        }
                    }
                }),
                /Simulated trainer profile persistence failure/
            );
        } finally {
            TrainerProfile.prototype.save = originalSave;
        }

        const evidenceCount =
            await CompetencyEvidence.countDocuments({
                org: organization._id,
                user: trainer._id
            });

        assert.equal(
            evidenceCount,
            0,
            "Evidence should not persist when recomputation fails"
        );

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.deepEqual(
            updatedProfile.competencySummary,
            originalProfile.competencySummary
        );

        assert.deepEqual(
            updatedProfile.skills,
            originalProfile.skills
        );

        assert.deepEqual(
            updatedProfile.evidenceStats,
            originalProfile.evidenceStats
        );

        assert.deepEqual(
            updatedProfile.experience,
            originalProfile.experience
        );

        assert.equal(
            updatedProfile.competencyRecomputedAt?.getTime() ?? null,
            originalProfile.competencyRecomputedAt?.getTime() ?? null
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Evidence deletion                                                          */
/* -------------------------------------------------------------------------- */

test(
    "soft-deletes pending evidence and recomputes the trainer profile",
    async () => {
        const evidence = await submitQualificationEvidence();

        const result = await deleteMyEvidence({
            evidenceId: evidence.id,
            orgId: organization._id,
            userId: trainer._id
        });

        assert.ok(result);

        const deletedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.ok(deletedEvidence);
        assert.equal(deletedEvidence.isDeleted, true);
        assert.ok(deletedEvidence.deletedAt);

        assert.equal(
            deletedEvidence.deletedBy.toString(),
            trainer._id.toString()
        );

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.deepEqual(updatedProfile.competencySummary, []);
        assert.deepEqual(updatedProfile.skills, []);
        assert.ok(updatedProfile.competencyRecomputedAt);

        assert.equal(
            await CompetencyEvidence.countDocuments({
                _id: evidence.id
            }),
            1
        );
    }
);

test(
    "prevents a trainer from deleting verified evidence",
    async () => {
        const evidence = await submitQualificationEvidence();

        await CompetencyEvidence.updateOne(
            { _id: evidence.id },
            {
                $set: {
                    "verification.status": "verified",
                    "verification.verifiedBy": trainer._id,
                    "verification.verifiedAt": new Date()
                }
            }
        );

        await assert.rejects(
            deleteMyEvidence({
                evidenceId: evidence.id,
                orgId: organization._id,
                userId: trainer._id
            })
        );

        const unchangedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(unchangedEvidence.isDeleted, false);

        assert.equal(
            unchangedEvidence.verification.status,
            "verified"
        );
    }
);

test(
    "rolls back evidence deletion when trainer profile recomputation fails",
    async () => {
        const evidence = await submitQualificationEvidence();

        const originalProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        const originalSave = TrainerProfile.prototype.save;

        try {
            TrainerProfile.prototype.save = async function () {
                throw new Error(
                    "Simulated trainer profile persistence failure"
                );
            };

            await assert.rejects(
                deleteMyEvidence({
                    evidenceId: evidence.id,
                    orgId: organization._id,
                    userId: trainer._id
                }),
                /Simulated trainer profile persistence failure/
            );
        } finally {
            TrainerProfile.prototype.save = originalSave;
        }

        const unchangedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.ok(unchangedEvidence);
        assert.equal(unchangedEvidence.isDeleted, false);
        assert.equal(unchangedEvidence.deletedAt, null);

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.deepEqual(
            updatedProfile.competencySummary,
            originalProfile.competencySummary
        );

        assert.deepEqual(
            updatedProfile.skills,
            originalProfile.skills
        );

        assert.deepEqual(
            updatedProfile.evidenceStats,
            originalProfile.evidenceStats
        );

        assert.deepEqual(
            updatedProfile.experience,
            originalProfile.experience
        );

        assert.equal(
            updatedProfile.competencyRecomputedAt?.getTime() ?? null,
            originalProfile.competencyRecomputedAt?.getTime() ?? null
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Evidence approval                                                          */
/* -------------------------------------------------------------------------- */

test(
    "approves pending evidence and recomputes the trainer profile",
    async () => {
        const evidence = await submitQualificationEvidence();

        const admin = await createTestAdmin(
            "admin-approval@example.com"
        );

        const result = await approveEvidence({
            evidenceId: evidence.id,
            orgId: organization._id,
            adminId: admin._id
        });

        assert.equal(result.id, evidence.id);
        assert.equal(result.verification.status, "verified");

        assert.equal(
            result.verification.verifiedBy,
            admin._id.toString()
        );

        assert.ok(result.verification.verifiedAt);

        const savedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(
            savedEvidence.verification.status,
            "verified"
        );

        assert.equal(
            savedEvidence.verification.verifiedBy.toString(),
            admin._id.toString()
        );

        assert.ok(savedEvidence.verification.verifiedAt);

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.equal(updatedProfile.evidenceStats.total, 1);
        assert.equal(updatedProfile.evidenceStats.verified, 1);
        assert.equal(updatedProfile.evidenceStats.verifiedRatio, 1);

        assert.equal(updatedProfile.competencySummary.length, 1);

        assert.equal(
            updatedProfile.competencySummary[0].evidenceCount,
            1
        );

        assert.equal(
            updatedProfile.competencySummary[0].verifiedEvidenceCount,
            1
        );

        assert.equal(updatedProfile.skills.length, 1);
        assert.equal(updatedProfile.skills[0].verified, true);
        assert.ok(updatedProfile.competencyRecomputedAt);
    }
);

/* -------------------------------------------------------------------------- */
/* Evidence rejection                                                         */
/* -------------------------------------------------------------------------- */

test(
    "rejects pending evidence and excludes it from competency calculations",
    async () => {
        const evidence = await submitQualificationEvidence();

        const admin = await createTestAdmin(
            "admin-rejection@example.com"
        );

        const rejectionReason =
            "The submitted qualification document is invalid.";

        const result = await rejectEvidence({
            evidenceId: evidence.id,
            orgId: organization._id,
            adminId: admin._id,
            reason: rejectionReason
        });

        assert.equal(result.id, evidence.id);
        assert.equal(result.verification.status, "rejected");

        assert.equal(
            result.verification.rejectionReason,
            rejectionReason
        );

        assert.equal(
            result.verification.rejectedBy,
            admin._id.toString()
        );
        assert.equal(result.verification.verifiedBy, null);
        assert.equal(result.verification.verifiedAt, null);

        const savedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(
            savedEvidence.verification.status,
            "rejected"
        );

        assert.equal(
            savedEvidence.verification.rejectionReason,
            rejectionReason
        );

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.deepEqual(updatedProfile.competencySummary, []);
        assert.deepEqual(updatedProfile.skills, []);

        assert.equal(updatedProfile.evidenceStats.verified, 0);
        assert.equal(updatedProfile.evidenceStats.verifiedRatio, 0);

        assert.ok(updatedProfile.competencyRecomputedAt);
    }
);

test(
    "prevents evidence from being reviewed more than once",
    async () => {
        const evidence = await submitQualificationEvidence();

        const admin = await createTestAdmin(
            "admin-duplicate@example.com"
        );

        await approveEvidence({
            evidenceId: evidence.id,
            orgId: organization._id,
            adminId: admin._id
        });

        await assert.rejects(
            rejectEvidence({
                evidenceId: evidence.id,
                orgId: organization._id,
                adminId: admin._id,
                reason: "Attempted second review"
            })
        );

        const savedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(
            savedEvidence.verification.status,
            "verified"
        );
    }
);

test(
    "rolls back evidence approval when trainer profile recomputation fails",
    async () => {
        const evidence = await submitQualificationEvidence();

        const admin = await createTestAdmin(
            "admin-rollback@example.com"
        );

        const originalProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        const originalSave = TrainerProfile.prototype.save;

        try {
            TrainerProfile.prototype.save = async function () {
                throw new Error(
                    "Simulated trainer profile persistence failure"
                );
            };

            await assert.rejects(
                approveEvidence({
                    evidenceId: evidence.id,
                    orgId: organization._id,
                    adminId: admin._id
                }),
                /Simulated trainer profile persistence failure/
            );
        } finally {
            TrainerProfile.prototype.save = originalSave;
        }

        const unchangedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(
            unchangedEvidence.verification.status,
            "self_reported"
        );

        assert.equal(
            unchangedEvidence.verification.verifiedBy,
            null
        );

        assert.equal(
            unchangedEvidence.verification.verifiedAt,
            null
        );

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.deepEqual(
            updatedProfile.competencySummary,
            originalProfile.competencySummary
        );

        assert.deepEqual(
            updatedProfile.skills,
            originalProfile.skills
        );

        assert.deepEqual(
            updatedProfile.evidenceStats,
            originalProfile.evidenceStats
        );

        assert.equal(
            updatedProfile.competencyRecomputedAt?.getTime() ?? null,
            originalProfile.competencyRecomputedAt?.getTime() ?? null
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Pending evidence retrieval                                                 */
/* -------------------------------------------------------------------------- */

test(
    "lists and retrieves pending evidence for administrator review",
    async () => {
        const evidence = await submitQualificationEvidence();

        const listResult = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 10
        });

        assert.equal(listResult.pagination.total, 1);
        assert.equal(listResult.items.length, 1);
        assert.equal(listResult.items[0].id, evidence.id);

        assert.equal(
            listResult.items[0].verification.status,
            "self_reported"
        );

        const detailResult = await getPendingEvidenceById({
            evidenceId: evidence.id,
            orgId: organization._id
        });

        assert.equal(detailResult.id, evidence.id);

        assert.equal(
            detailResult.verification.status,
            "self_reported"
        );

        assert.equal(
            detailResult.user.id,
            trainer._id.toString()
        );

        assert.equal(detailResult.competencies.length, 1);
        assert.equal(detailResult.skills.length, 1);
    }
);

test(
    "rolls back evidence rejection when trainer profile recomputation fails",
    async () => {
        const evidence = await submitQualificationEvidence();

        const admin = await createTestAdmin(
            "admin-rejection-rollback@example.com"
        );

        const originalProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        const originalSave = TrainerProfile.prototype.save;

        try {
            TrainerProfile.prototype.save = async function () {
                throw new Error(
                    "Simulated trainer profile persistence failure"
                );
            };

            await assert.rejects(
                rejectEvidence({
                    evidenceId: evidence.id,
                    orgId: organization._id,
                    adminId: admin._id,
                    reason: "Invalid qualification document"
                }),
                /Simulated trainer profile persistence failure/
            );
        } finally {
            TrainerProfile.prototype.save = originalSave;
        }

        const unchangedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(
            unchangedEvidence.verification.status,
            "self_reported"
        );

        assert.equal(
            unchangedEvidence.verification.verifiedBy,
            null
        );

        assert.equal(
            unchangedEvidence.verification.verifiedAt,
            null
        );

        assert.equal(
            unchangedEvidence.verification.rejectionReason,
            null
        );

        const updatedProfile = await TrainerProfile.findById(
            trainerProfile._id
        ).lean();

        assert.deepEqual(
            updatedProfile.competencySummary,
            originalProfile.competencySummary
        );

        assert.deepEqual(
            updatedProfile.skills,
            originalProfile.skills
        );

        assert.deepEqual(
            updatedProfile.evidenceStats,
            originalProfile.evidenceStats
        );

        assert.equal(
            updatedProfile.competencyRecomputedAt?.getTime() ?? null,
            originalProfile.competencyRecomputedAt?.getTime() ?? null
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Organization isolation                                                     */
/* -------------------------------------------------------------------------- */

test(
    "prevents another organization from retrieving or reviewing evidence",
    async () => {
        const evidence = await submitQualificationEvidence();

        const otherOrganization = await Organization.create({
            name: "Other Organization",
            slug: "other-organization",
            createdBy: trainer._id
        });

        const admin = await createTestAdmin(
            "other-admin@example.com"
        );

        const listResult = await listPendingEvidence({
            orgId: otherOrganization._id,
            page: 1,
            limit: 10
        });

        assert.equal(listResult.pagination.total, 0);
        assert.equal(listResult.items.length, 0);

        await assert.rejects(
            getPendingEvidenceById({
                evidenceId: evidence.id,
                orgId: otherOrganization._id
            })
        );

        await assert.rejects(
            approveEvidence({
                evidenceId: evidence.id,
                orgId: otherOrganization._id,
                adminId: admin._id
            })
        );

        await assert.rejects(
            rejectEvidence({
                evidenceId: evidence.id,
                orgId: otherOrganization._id,
                adminId: admin._id,
                reason: "Other organization review"
            })
        );

        const unchangedEvidence = await CompetencyEvidence.findById(
            evidence.id
        ).lean();

        assert.equal(
            unchangedEvidence.verification.status,
            "self_reported"
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Deleted and superseded evidence                                            */
/* -------------------------------------------------------------------------- */

test(
    "excludes deleted and superseded evidence from pending review",
    async () => {
        const deletedEvidence = await submitQualificationEvidence({
            title: "Deleted Qualification"
        });

        const supersededEvidence = await submitQualificationEvidence({
            title: "Superseded Qualification"
        });

        const activeEvidence = await submitQualificationEvidence({
            title: "Active Qualification"
        });

        // Mark one evidence record as deleted.
        await CompetencyEvidence.updateOne(
            { _id: deletedEvidence.id },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: new Date(),
                    deletedBy: trainer._id
                }
            }
        );

        // Mark another evidence record as superseded.
        await CompetencyEvidence.updateOne(
            { _id: supersededEvidence.id },
            {
                $set: {
                    supersededBy: activeEvidence.id,
                    supersededAt: new Date()
                }
            }
        );

        // Confirm both changes were persisted.
        const savedDeletedEvidence = await CompetencyEvidence.findById(
            deletedEvidence.id
        ).lean();

        const savedSupersededEvidence = await CompetencyEvidence.findById(
            supersededEvidence.id
        ).lean();

        assert.equal(savedDeletedEvidence.isDeleted, true);
        assert.ok(savedDeletedEvidence.deletedAt);

        assert.equal(
            savedDeletedEvidence.deletedBy.toString(),
            trainer._id.toString()
        );

        assert.equal(
            savedSupersededEvidence.supersededBy.toString(),
            activeEvidence.id
        );

        assert.ok(savedSupersededEvidence.supersededAt);

        // Only active evidence should appear in the pending queue.
        const result = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 10
        });

        assert.equal(result.pagination.total, 1);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].id, activeEvidence.id);

        // Deleted evidence must not be retrievable.
        await assert.rejects(
            getPendingEvidenceById({
                evidenceId: deletedEvidence.id,
                orgId: organization._id
            }),
            (error) => error.statusCode === 404
        );

        // Superseded evidence must not be retrievable.
        await assert.rejects(
            getPendingEvidenceById({
                evidenceId: supersededEvidence.id,
                orgId: organization._id
            }),
            (error) => error.statusCode === 404
        );

        const admin = await createTestAdmin(
            "deleted-review-admin@example.com"
        );

        // Deleted evidence must not be approved.
        await assert.rejects(
            approveEvidence({
                evidenceId: deletedEvidence.id,
                orgId: organization._id,
                adminId: admin._id
            })
        );

        // Superseded evidence must not be rejected.
        await assert.rejects(
            rejectEvidence({
                evidenceId: supersededEvidence.id,
                orgId: organization._id,
                adminId: admin._id,
                reason: "This evidence has been superseded"
            })
        );

        // Neither record should have had its review status changed.
        const unchangedDeletedEvidence =
            await CompetencyEvidence.findById(
                deletedEvidence.id
            ).lean();

        const unchangedSupersededEvidence =
            await CompetencyEvidence.findById(
                supersededEvidence.id
            ).lean();

        assert.equal(
            unchangedDeletedEvidence.verification.status,
            "self_reported"
        );

        assert.equal(
            unchangedSupersededEvidence.verification.status,
            "self_reported"
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Pending evidence pagination                                                */
/* -------------------------------------------------------------------------- */

test(
    "paginates pending evidence correctly",
    async () => {
        await submitQualificationEvidence({
            title: "Qualification One"
        });

        await submitQualificationEvidence({
            title: "Qualification Two"
        });

        await submitQualificationEvidence({
            title: "Qualification Three"
        });

        const firstPage = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 2
        });

        assert.equal(firstPage.items.length, 2);
        assert.equal(firstPage.pagination.page, 1);
        assert.equal(firstPage.pagination.limit, 2);
        assert.equal(firstPage.pagination.total, 3);
        assert.equal(firstPage.pagination.totalPages, 2);

        const secondPage = await listPendingEvidence({
            orgId: organization._id,
            page: 2,
            limit: 2
        });

        assert.equal(secondPage.items.length, 1);
        assert.equal(secondPage.pagination.page, 2);
        assert.equal(secondPage.pagination.totalPages, 2);
    }
);

/* -------------------------------------------------------------------------- */
/* Pending evidence search                                                   */
/* -------------------------------------------------------------------------- */

test(
    "searches pending evidence by title and description",
    async () => {
        await submitQualificationEvidence({
            title: "JavaScript Qualification",
            description: "Frontend development"
        });

        await submitQualificationEvidence({
            title: "Database Qualification",
            description: "MongoDB and data modelling"
        });

        const titleResult = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 10,
            search: "JavaScript"
        });

        assert.equal(titleResult.pagination.total, 1);

        assert.equal(
            titleResult.items[0].title,
            "JavaScript Qualification"
        );

        const descriptionResult = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 10,
            search: "MongoDB"
        });

        assert.equal(descriptionResult.pagination.total, 1);

        assert.equal(
            descriptionResult.items[0].title,
            "Database Qualification"
        );
    }
);

test(
    "treats special regex characters in search as literal text",
    async () => {
        await submitQualificationEvidence({
            title: "C++ Qualification"
        });

        await submitQualificationEvidence({
            title: "C Qualification"
        });

        const result = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 10,
            search: "C++"
        });

        assert.equal(result.pagination.total, 1);

        assert.equal(
            result.items[0].title,
            "C++ Qualification"
        );
    }
);

/* -------------------------------------------------------------------------- */
/* Pending queue status filtering                                             */
/* -------------------------------------------------------------------------- */

test(
    "removes approved and rejected evidence from the pending queue",
    async () => {
        const approvedEvidence = await submitQualificationEvidence({
            title: "Approved Qualification"
        });

        const rejectedEvidence = await submitQualificationEvidence({
            title: "Rejected Qualification"
        });

        const admin = await createTestAdmin(
            "queue-admin@example.com"
        );

        await approveEvidence({
            evidenceId: approvedEvidence.id,
            orgId: organization._id,
            adminId: admin._id
        });

        await rejectEvidence({
            evidenceId: rejectedEvidence.id,
            orgId: organization._id,
            adminId: admin._id,
            reason: "Document could not be verified"
        });

        const result = await listPendingEvidence({
            orgId: organization._id,
            page: 1,
            limit: 10
        });

        assert.equal(result.pagination.total, 0);
        assert.deepEqual(result.items, []);
    }
);

/* -------------------------------------------------------------------------- */
/* Review response data protection                                            */
/* -------------------------------------------------------------------------- */

test(
    "does not expose private file storage metadata in review responses",
    async () => {
        const evidence = await submitQualificationEvidence();

        await CompetencyEvidence.updateOne(
            { _id: evidence.id },
            {
                $set: {
                    file: {
                        originalName: "degree.pdf",
                        storageProvider: "s3",
                        storageKey: "private/evidence/degree-123",
                        mimeType: "application/pdf",
                        size: 102400,
                        checksum: "sample-checksum",
                        uploadedAt: new Date()
                    }
                }
            }
        );

        const result = await getPendingEvidenceById({
            evidenceId: evidence.id,
            orgId: organization._id
        });

        assert.equal(result.file.originalName, "degree.pdf");
        assert.equal(result.file.mimeType, "application/pdf");
        assert.equal(result.file.size, 102400);

        assert.equal("storageKey" in result.file, false);
        assert.equal("storageProvider" in result.file, false);
        assert.equal("checksum" in result.file, false);
    }
);