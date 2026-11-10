import { resolveCompetencyLevel } from "./evidence.engine.js";

/**
 * @name mapEvidenceDocumentToEngineInput
 * @description Converts an evidence document into the normalized
 * input structure expected by the evidence calculation engine.
 *
 * The mapper accepts plain objects, including objects returned
 * by Mongoose lean queries. It does not perform database operations.
 *
 * @param {Object} evidence - Evidence document.
 * @returns {Object} Normalized evidence record.
 * @throws {TypeError} If the evidence record is invalid.
 */
export const mapEvidenceDocumentToEngineInput = (evidence) => {
    if (
        !evidence ||
        typeof evidence !== "object" ||
        Array.isArray(evidence)
    ) {
        throw new TypeError("A valid evidence document must be provided.");
    }

    return {
        _id: evidence._id ?? null,

        type: evidence.type,

        competencies: Array.isArray(evidence.competencies)
            ? evidence.competencies
            : [],

        skills: Array.isArray(evidence.skills)
            ? evidence.skills
            : [],

        details: evidence.details ?? {},

        verification: {
            status: evidence.verification?.status ?? null
        },

        isDeleted: evidence.isDeleted ?? false,

        supersededBy: evidence.supersededBy ?? null,

        createdAt: evidence.createdAt ?? null
    };
};


/**
 * @name mapEvidenceDocumentsToEngineInput
 * @description Converts multiple evidence documents into the
 * normalized input structure expected by the evidence engine.
 *
 * @param {Object[]} evidenceDocuments - Evidence documents.
 * @returns {Object[]} Normalized evidence records.
 * @throws {TypeError} If the input is not an array.
 */
export const mapEvidenceDocumentsToEngineInput = (
    evidenceDocuments = []
) => {
    if (!Array.isArray(evidenceDocuments)) {
        throw new TypeError("Evidence documents must be provided as an array.");
    }

    return evidenceDocuments.map(mapEvidenceDocumentToEngineInput);
};


/**
 * @name mapEvidenceSummaryToTrainerProfile
 * @description Converts an evidence engine summary into the
 * derived fields supported by the TrainerProfile schema.
 *
 * @param {Object} summary - Calculated evidence summary.
 * @param {Object} [config] - Evidence calculation configuration.
 * @returns {Object} TrainerProfile derived fields.
 * @throws {TypeError} If the summary is invalid.
 */
export const mapEvidenceSummaryToTrainerProfile = (
    summary,
    config
) => {
    if (
        !summary ||
        typeof summary !== "object" ||
        Array.isArray(summary)
    ) {
        throw new TypeError("A valid evidence summary must be provided.");
    }

    if (
        !summary.evidenceStats ||
        !summary.experience ||
        !Array.isArray(summary.competencies) ||
        !Array.isArray(summary.skills) ||
        !summary.generatedAt
    ) {
        throw new TypeError("The evidence summary is incomplete.");
    }

    const competencySummary = summary.competencies.map(
        (competency) => {
            const proficiency = resolveCompetencyLevel(
                competency.score,
                config?.proficiencyThresholds
            );

            return {
                competency: competency.id,
                points: competency.score,
                level: proficiency.level,
                levelNum: proficiency.levelNum,
                evidenceCount: competency.contributionsCount,
                verifiedEvidenceCount:
                    competency.verifiedEvidenceCount
            };
        }
    );

    const skills = summary.skills.map((skill) => ({
        skill: skill.id,
        verified: skill.verifiedEvidenceCount > 0,
        evidenceCount: skill.contributionsCount
    }));

    const totalEvidence = summary.evidenceStats.total;
    const verifiedEvidence = summary.evidenceStats.verified;

    const verifiedRatio = totalEvidence > 0
        ? verifiedEvidence / totalEvidence
        : 0;

    return {
        competencySummary,
        skills,

        evidenceStats: {
            total: totalEvidence,
            verified: verifiedEvidence,
            verifiedRatio,
            latestEvidenceAt: summary.latestEvidenceAt ?? null
        },

        experience: {
            industryYears:
                summary.experience.professionalExperienceYears,
            teachingYears:
                summary.experience.teachingExperienceYears
        },

        competencyRecomputedAt: summary.generatedAt
    };
};

