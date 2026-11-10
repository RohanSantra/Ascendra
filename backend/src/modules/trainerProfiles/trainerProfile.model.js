import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Stores a trainer's professional information.
 *
 * @name trainerProfessionalDetailsSchema
 */
const trainerProfessionalDetailsSchema = new Schema(
    {
        headline: {
            type: String,
            trim: true,
            maxlength: 200
        },
        bio: {
            type: String,
            trim: true,
            maxlength: 3000
        },
        specialization: {
            type: String,
            trim: true,
            maxlength: 200
        },
        currentDesignation: {
            type: String,
            trim: true,
            maxlength: 150
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Tracks a trainer's eligibility review.
 *
 * This approval is independent of organization membership approval.
 *
 * @name trainerApprovalSchema
 */
const trainerApprovalSchema = new Schema(
    {
        status: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected",
                "suspended"
            ],
            default: "pending",
            required: true
        },
        reviewedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        reviewedAt: {
            type: Date,
            default: null
        },
        suspendedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        suspendedAt: {
            type: Date,
            default: null
        },
        suspensionReason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: null
        },
        rejectionReason: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: null
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Stores the calculated competency score and proficiency level
 * for a trainer.
 *
 * These values are derived from eligible evidence and must be
 * recalculated by the evidence recomputation process.
 *
 * @name trainerCompetencySummarySchema
 */
const trainerCompetencySummarySchema = new Schema(
    {
        competency: {
            type: Schema.Types.ObjectId,
            ref: "Competency",
            required: true
        },
        points: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        level: {
            type: String,
            enum: [
                "beginner",
                "intermediate",
                "advanced",
                "expert"
            ],
            default: "beginner",
            required: true
        },
        levelNum: {
            type: Number,
            enum: [1, 2, 3, 4],
            default: 1,
            required: true
        },
        evidenceCount: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        verifiedEvidenceCount: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Stores a trainer's derived skill evidence summary.
 *
 * @name trainerSkillSummarySchema
 */
const trainerSkillSummarySchema = new Schema(
    {
        skill: {
            type: Schema.Types.ObjectId,
            ref: "Skill",
            required: true
        },
        verified: {
            type: Boolean,
            default: false,
            required: true
        },
        evidenceCount: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Stores aggregated evidence statistics for a trainer.
 *
 * @name trainerEvidenceStatsSchema
 */
const trainerEvidenceStatsSchema = new Schema(
    {
        total: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        verified: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        verifiedRatio: {
            type: Number,
            min: 0,
            max: 1,
            default: 0,
            required: true
        },
        latestEvidenceAt: {
            type: Date,
            default: null
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Stores calculated professional and teaching experience.
 *
 * Experience years are derived from merged date intervals.
 * Overlapping employment or teaching periods must not be counted twice.
 *
 * @name trainerExperienceSchema
 */
const trainerExperienceSchema = new Schema(
    {
        industryYears: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        teachingYears: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Stores trainer availability and assignment capacity.
 *
 * activeTrainings is maintained by assignment operations.
 * Capacity reservations must use an atomic conditional update.
 *
 * @name trainerAvailabilitySchema
 */
const trainerAvailabilitySchema = new Schema(
    {
        status: {
            type: String,
            enum: [
                "available",
                "limited",
                "unavailable",
                "on_leave"
            ],
            default: "available",
            required: true
        },
        activeTrainings: {
            type: Number,
            min: 0,
            default: 0,
            required: true
        },
        maxConcurrentTrainings: {
            type: Number,
            min: 1,
            default: 3,
            required: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Stores profile completion information.
 *
 * @name trainerCompletionSchema
 */
const trainerCompletionSchema = new Schema(
    {
        percentage: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
            required: true
        },
        profileCompletedAt: {
            type: Date,
            default: null
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Represents a trainer's organisation-specific professional profile.
 *
 * Competency, skill, experience and evidence statistics are derived
 * summaries. They are maintained by the evidence recomputation
 * process rather than directly edited by trainer-facing operations.
 *
 * The schema retains its Mongoose version key and uses optimistic
 * concurrency to help prevent conflicting profile updates.
 *
 * @name trainerProfileSchema
 */
const trainerProfileSchema = new Schema(
    {
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        professionalDetails: {
            type: trainerProfessionalDetailsSchema,
            default: () => ({})
        },
        approval: {
            type: trainerApprovalSchema,
            default: () => ({})
        },
        competencySummary: {
            type: [trainerCompetencySummarySchema],
            default: []
        },
        skills: {
            type: [trainerSkillSummarySchema],
            default: []
        },
        evidenceStats: {
            type: trainerEvidenceStatsSchema,
            default: () => ({})
        },
        experience: {
            type: trainerExperienceSchema,
            default: () => ({})
        },
        availability: {
            type: trainerAvailabilitySchema,
            default: () => ({})
        },
        completion: {
            type: trainerCompletionSchema,
            default: () => ({})
        },
        competencyRecomputedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: "__v",
        optimisticConcurrency: true
    }
);

/**
 * Ensures a user has only one trainer profile per organization.
 */
trainerProfileSchema.index(
    { org: 1, user: 1 },
    {
        unique: true,
        name: "trainer_profile_org_user_unique"
    }
);

/**
 * Supports matching candidate retrieval by approval and availability.
 */
trainerProfileSchema.index(
    {
        org: 1,
        "approval.status": 1,
        "availability.status": 1
    },
    { name: "trainer_profile_matching_eligibility" }
);

/**
 * Supports matching and filtering trainers by competency.
 */
trainerProfileSchema.index(
    { org: 1, "competencySummary.competency": 1 },
    { name: "trainer_profile_competency" }
);

/**
 * Supports matching and filtering trainers by skill.
 */
trainerProfileSchema.index(
    { org: 1, "skills.skill": 1 },
    { name: "trainer_profile_skill" }
);

const TrainerProfile =
    models.TrainerProfile ||
    model("TrainerProfile", trainerProfileSchema);

export default TrainerProfile;