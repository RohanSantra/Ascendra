
import {
    calculateTrainerEvidenceSummary,
    getDefaultEvidenceConfig
} from "./evidence.engine.js";

import {
    mapEvidenceDocumentsToEngineInput,
    mapEvidenceSummaryToTrainerProfile
} from "./evidence.mapper.js";

import {
    getTrainerEvidenceForRecomputation,
    updateTrainerEvidenceSummary
} from "./evidence.repository.js";

/**
 * @name createEvidenceRecomputationService
 * @description Creates a dependency-injected service for recomputing
 * a trainer's competency and skill summaries from evidence records.
 *
 * The optional MongoDB session is propagated through evidence retrieval
 * and trainer profile updating so both operations can participate
 * in the same database transaction.
 *
 * @param {Object} dependencies - Injectable service dependencies.
 * @param {Function} dependencies.getEvidence - Evidence retrieval function.
 * @param {Function} dependencies.updateSummary - Profile update function.
 * @param {Function} dependencies.mapEvidence - Evidence input mapper.
 * @param {Function} dependencies.calculateSummary - Evidence engine.
 * @param {Function} dependencies.mapProfile - Profile summary mapper.
 * @returns {Function} Evidence recomputation function.
 */
export const createEvidenceRecomputationService = ({
    getEvidence = getTrainerEvidenceForRecomputation,
    updateSummary = updateTrainerEvidenceSummary,
    mapEvidence = mapEvidenceDocumentsToEngineInput,
    calculateSummary = calculateTrainerEvidenceSummary,
    mapProfile = mapEvidenceSummaryToTrainerProfile
} = {}) => {
    return async ({
        orgId,
        trainerProfileId,
        now = new Date(),
        config = getDefaultEvidenceConfig(),
        session
    }) => {
        // Step 1: Retrieve all trainer evidence records.
        const evidenceDocuments = await getEvidence({
            orgId,
            trainerProfileId,
            ...(session ? { session } : {})
        });

        // Step 2: Convert database documents into engine inputs.
        const evidenceRecords = mapEvidence(evidenceDocuments);

        // Step 3: Calculate competency and skill summaries.
        const summary = calculateSummary({
            evidenceRecords,
            now,
            config
        });

        // Step 4: Map the calculated summary to TrainerProfile fields.
        const trainerProfileSummary = mapProfile(summary, config);

        // Step 5: Persist the derived summary.
        return updateSummary({
            orgId,
            trainerProfileId,
            summary: trainerProfileSummary,
            ...(session ? { session } : {})
        });
    };
};

/**
 * @name recomputeTrainerEvidenceSummary
 * @description Recomputes and persists a trainer's evidence-derived
 * competency, skill, and experience summaries.
 *
 * @param {Object} params - Recalculation parameters.
 * @param {string} params.orgId - Organization ID.
 * @param {string} params.trainerProfileId - Trainer profile ID.
 * @param {Date} [params.now] - Calculation reference date.
 * @param {Object} [params.config] - Evidence calculation configuration.
 * @param {Object} [params.session] - Optional MongoDB session.
 * @returns {Promise<Object>} Updated trainer profile.
 */
export const recomputeTrainerEvidenceSummary =
    createEvidenceRecomputationService();
