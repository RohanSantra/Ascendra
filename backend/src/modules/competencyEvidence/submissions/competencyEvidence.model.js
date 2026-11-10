import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

/**
 * Stores metadata for an uploaded evidence file.
 *
 * The actual file is stored outside MongoDB. This subdocument
 * contains only its storage and validation metadata.
 *
 * @name evidenceFileSchema
 */
const evidenceFileSchema = new Schema(
    {
        originalName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },
        storageProvider: {
            type: String,
            enum: ["local", "cloudinary", "s3"],
            required: true
        },
        storageKey: {
            type: String,
            required: true,
            trim: true
        },
        mimeType: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150
        },
        size: {
            type: Number,
            required: true,
            min: 1
        },
        checksum: {
            type: String,
            trim: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now,
            required: true
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Contains type-specific information about competency evidence.
 *
 * Only the fields relevant to the selected evidence type should
 * be populated. The evidence validation layer enforces this rule.
 *
 * Assessment evidence uses `takenAt` to represent when the
 * assessment occurred, avoiding confusion with document timestamps.
 *
 * @name evidenceDetailsSchema
 */
const evidenceDetailsSchema = new Schema(
    {
        // Qualification details
        qualificationName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        institution: {
            type: String,
            trim: true,
            maxlength: 200
        },
        fieldOfStudy: {
            type: String,
            trim: true,
            maxlength: 150
        },
        issuedAt: {
            type: Date
        },

        // Certification details
        certificateName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        issuer: {
            type: String,
            trim: true,
            maxlength: 200
        },
        credentialNumber: {
            type: String,
            trim: true,
            maxlength: 150
        },
        expiresAt: {
            type: Date
        },

        // Professional experience details
        organizationName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        designation: {
            type: String,
            trim: true,
            maxlength: 150
        },
        industry: {
            type: String,
            trim: true,
            maxlength: 150
        },
        startDate: {
            type: Date
        },
        endDate: {
            type: Date
        },
        isOngoing: {
            type: Boolean,
            default: false
        },

        // Teaching experience details
        subject: {
            type: String,
            trim: true,
            maxlength: 150
        },
        teachingStartDate: {
            type: Date
        },
        teachingEndDate: {
            type: Date
        },
        isTeachingOngoing: {
            type: Boolean,
            default: false
        },
        // Assessment evidence details
        assessmentName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        score: {
            type: Number,
            min: 0
        },
        maximumScore: {
            type: Number,
            min: 0.000001,
            validate: {
                validator: (value) =>
                    value === undefined || value > 0,
                message: "Maximum score must be greater than zero."
            }
        },
        takenAt: {
            type: Date
        }
    },
    {
        _id: false,
        versionKey: false
    }
);

/**
 * Tracks the review status of submitted evidence.
 *
 * Self-reported evidence may contribute to provisional matching
 * scores with a lower trust value. Rejected evidence is excluded.
 *
 * @name evidenceVerificationSchema
 */
const evidenceVerificationSchema = new Schema(
    {
        status: {
            type: String,
            enum: ["self_reported", "verified", "rejected"],
            default: "self_reported",
            required: true
        },
        verifiedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        verifiedAt: {
            type: Date,
            default: null
        },
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        rejectedAt: {
            type: Date,
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
 * Represents evidence submitted by a trainer to demonstrate
 * qualifications, certifications, experience, teaching or assessment.
 *
 * Evidence records are retained when deleted or superseded so that
 * historical matching results can be understood and audited.
 *
 * @name competencyEvidenceSchema
 */
const competencyEvidenceSchema = new Schema(
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
        trainerProfile: {
            type: Schema.Types.ObjectId,
            ref: "TrainerProfile",
            required: true
        },
        type: {
            type: String,
            enum: [
                "qualification",
                "certification",
                "experience",
                "teaching",
                "assessment"
            ],
            required: true
        },
        competencies: [
            {
                type: Schema.Types.ObjectId,
                ref: "Competency"
            }
        ],
        skills: [
            {
                type: Schema.Types.ObjectId,
                ref: "Skill"
            }
        ],
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 200
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000
        },
        details: {
            type: evidenceDetailsSchema,
            default: () => ({})
        },
        file: {
            type: evidenceFileSchema,
            default: null
        },
        verification: {
            type: evidenceVerificationSchema,
            default: () => ({})
        },
        isDeleted: {
            type: Boolean,
            default: false,
            required: true
        },
        deletedAt: {
            type: Date,
            default: null
        },
        deletedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        supersededBy: {
            type: Schema.Types.ObjectId,
            ref: "CompetencyEvidence",
            default: null
        },
        supersededAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

/**
 * Supports retrieving a trainer's evidence by organization,
 * trainer profile and evidence type.
 */
competencyEvidenceSchema.index(
    {
        org: 1,
        trainerProfile: 1,
        _id: 1
    },
    {
        name: "evidence_org_profile_recomputation"
    }
);

/**
 * Supports retrieving evidence for verification queues.
 */
competencyEvidenceSchema.index(
    { org: 1, "verification.status": 1, createdAt: -1 },
    { name: "evidence_org_verification_created" }
);

/**
 * Supports finding evidence associated with a competency.
 */
competencyEvidenceSchema.index(
    { org: 1, competencies: 1 },
    { name: "evidence_org_competencies" }
);

/**
 * Supports finding evidence associated with a skill.
 */
competencyEvidenceSchema.index(
    { org: 1, skills: 1 },
    { name: "evidence_org_skills" }
);

/**
 * Supports retrieving active evidence for a trainer profile.
 */
competencyEvidenceSchema.index(
    {
        org: 1,
        trainerProfile: 1,
        isDeleted: 1,
        supersededBy: 1
    },
    { name: "evidence_org_profile_active" }
);

const CompetencyEvidence =
    models.CompetencyEvidence ||
    model("CompetencyEvidence", competencyEvidenceSchema);

export default CompetencyEvidence;