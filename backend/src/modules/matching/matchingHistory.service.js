import {
    getMatchRuns,
    getMatchRunById
} from "./matching.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../core/constants/index.js";

import AppError from "../../core/errors/AppError.js";

/**
 * @name getMatchingHistory
 * @description Retrieves paginated matching run history
 * for the currently selected organization.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @returns {Promise<Object>}
 */
export const getMatchingHistory = async ({
    orgId,
    page = 1,
    limit = 20
}) => {
    return getMatchRuns({
        orgId,
        page,
        limit
    });
};

/**
 * @name getMatchingRunDetails
 * @description Retrieves a matching run by ID while
 * enforcing organization ownership.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.matchRunId
 * @returns {Promise<Object>}
 * @throws {AppError} If the matching run does not exist
 * within the selected organization.
 */
export const getMatchingRunDetails = async ({
    orgId,
    matchRunId
}) => {
    const matchRun = await getMatchRunById({
        orgId,
        matchRunId
    });

    if (!matchRun) {
        throw new AppError(
            "Matching run not found.",
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return matchRun;
};