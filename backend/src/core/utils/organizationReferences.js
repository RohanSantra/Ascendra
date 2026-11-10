
import mongoose from "mongoose";

import { AppError } from "../errors/index.js";
import {
    ERROR_CODES,
    HTTP_STATUS
} from "../constants/index.js";

/**
 * Verifies that referenced documents belong to the expected organization.
 *
 * This helper checks both document existence and organization ownership.
 * It can validate a document by its own `_id` or through another
 * top-level reference field, such as `user` on an organization membership.
 *
 * The queried model must contain the configured organization field.
 *
 * @name assertOrganizationReferences
 * @param {Object} options - Reference validation options.
 * @param {import("mongoose").Model} options.model - Mongoose model to query.
 * @param {string|import("mongoose").Types.ObjectId|Object|Array} options.ids - One ID or an array of IDs.
 * @param {string|import("mongoose").Types.ObjectId} options.organizationId - Expected organization ID.
 * @param {string} [options.referenceField="_id"] - Top-level field containing the referenced ID.
 * @param {string} [options.organizationField="org"] - Field containing the organization ID.
 * @param {import("mongoose").ClientSession} [options.session] - Optional MongoDB transaction session.
 * @param {string} [options.resourceName="Referenced resource"] - Resource name used in error messages.
 * @param {boolean} [options.allowEmpty=true] - Whether an empty reference collection is valid.
 * @returns {Promise<Array<import("mongoose").Types.ObjectId>>} Validated, unique reference IDs.
 * @throws {AppError} If one or more references are invalid or outside the organization.
 */
const assertOrganizationReferences = async ({
    model,
    ids,
    organizationId,
    referenceField = "_id",
    organizationField = "org",
    session,
    resourceName = "Referenced resource",
    allowEmpty = true
}) => {
    if (!model || typeof model.find !== "function") {
        throw new TypeError(
            "assertOrganizationReferences requires a valid Mongoose model."
        );
    }

    if (
        typeof referenceField !== "string" ||
        !referenceField.trim() ||
        referenceField.includes(".") ||
        typeof organizationField !== "string" ||
        !organizationField.trim() ||
        organizationField.includes(".")
    ) {
        throw new TypeError(
            "Reference and organization fields must be non-empty top-level field names."
        );
    }

    if (!mongoose.isObjectIdOrHexString(organizationId)) {
        throw new TypeError(
            "A valid organization ObjectId is required."
        );
    }

    const suppliedIds = Array.isArray(ids) ? ids : [ids];

    if (suppliedIds.length === 0 || suppliedIds.every((id) => id == null)) {
        if (allowEmpty) {
            return [];
        }

        throw new AppError(
            `${resourceName} reference is required.`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.INVALID_REQUEST
        );
    }

    const normalizedIds = suppliedIds.map((value) => {
        const id = value && typeof value === "object" && "_id" in value
            ? value._id
            : value;

        if (!mongoose.isObjectIdOrHexString(id)) {
            throw new AppError(
                `${resourceName} contains an invalid reference ID.`,
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.INVALID_PARAMETER
            );
        }

        return new mongoose.Types.ObjectId(id);
    });

    const uniqueIds = [
        ...new Map(
            normalizedIds.map((id) => [id.toString(), id])
        ).values()
    ];

    const filter = {
        [referenceField]: { $in: uniqueIds },
        [organizationField]: new mongoose.Types.ObjectId(organizationId)
    };

    let query = model
        .find(filter)
        .select({ [referenceField]: 1 })
        .lean();

    if (session) {
        query = query.session(session);
    }

    const matchingDocuments = await query.exec();

    const matchingIds = new Set(
        matchingDocuments.map((document) => {
            const matchedId = referenceField === "_id"
                ? document._id
                : document[referenceField];

            return matchedId?.toString();
        })
    );

    const allReferencesBelongToOrganization = uniqueIds.every(
        (id) => matchingIds.has(id.toString())
    );

    if (!allReferencesBelongToOrganization) {
        throw new AppError(
            `One or more ${resourceName.toLowerCase()} references were not found.`,
            HTTP_STATUS.NOT_FOUND,
            ERROR_CODES.RESOURCE_NOT_FOUND
        );
    }

    return uniqueIds;
};

export default assertOrganizationReferences;
