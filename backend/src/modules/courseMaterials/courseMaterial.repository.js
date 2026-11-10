import CourseMaterial from "./courseMaterial.model.js";


/**
 * Creates a course material record.
 *
 * Supports an optional MongoDB session so material creation
 * can participate in a transaction with upload-intent consumption.
 *
 * @param {Object} materialData
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 *
 * @returns {Promise<Object>}
 */
export const createCourseMaterial = async (
    materialData,
    { session = null } = {}
) => {
    const [material] = await CourseMaterial.create(
        [materialData],
        { session }
    );

    return material;
};


/**
 * Retrieves a course material by ID within its organisation
 * and course boundaries.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.materialId
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 *
 * @returns {Promise<Object|null>}
 */
export const getCourseMaterialById = async (
    {
        orgId,
        courseId,
        materialId
    },
    { session = null } = {}
) => {
    let query = CourseMaterial.findOne({
        _id: materialId,
        org: orgId,
        course: courseId
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves course materials with filtering, pagination
 * and sorting.
 *
 * Only explicitly supported sort fields are accepted.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {Object} [params.filters]
 * @param {Object} [params.pagination]
 * @param {Object} [params.sort]
 *
 * @returns {Promise<Object>}
 */
export const getCourseMaterials = async ({
    orgId,
    courseId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    const page = Math.max(
        1,
        Number.parseInt(pagination.page, 10) || 1
    );

    const limit = Math.min(
        100,
        Math.max(
            1,
            Number.parseInt(pagination.limit, 10) || 20
        )
    );

    const allowedSortFields = [
        "displayOrder",
        "createdAt",
        "updatedAt",
        "title"
    ];

    const sortBy = allowedSortFields.includes(sort.sortBy)
        ? sort.sortBy
        : "displayOrder";

    const sortOrder = sort.sortOrder === "desc" ? -1 : 1;

    const mongoFilter = {
        org: orgId,
        course: courseId
    };

    if (filters.status) {
        mongoFilter.status = filters.status;
    } else {
        mongoFilter.status = "active";
    }

    const sortOptions = {
        [sortBy]: sortOrder,
        _id: 1
    };

    const skip = (page - 1) * limit;

    const [materials, total] = await Promise.all([
        CourseMaterial.find(mongoFilter)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .populate(
                "uploadedBy",
                "firstName lastName email"
            )
            .lean(),

        CourseMaterial.countDocuments(mongoFilter)
    ]);

    return {
        data: materials,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1
        }
    };
};


/**
 * Updates course material metadata within its organisation
 * and course boundaries.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.materialId
 * @param {Object} params.updates
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 *
 * @returns {Promise<Object|null>}
 */
export const updateCourseMaterial = async (
    {
        orgId,
        courseId,
        materialId,
        updates
    },
    { session = null } = {}
) => {
    let query = CourseMaterial.findOneAndUpdate(
        {
            _id: materialId,
            org: orgId,
            course: courseId,
            status: "active"
        },
        {
            $set: updates
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Archives an active course material.
 *
 * The Cloudinary asset is retained. Archiving only changes
 * the database record's lifecycle status.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.materialId
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 *
 * @returns {Promise<Object|null>}
 */
export const archiveCourseMaterial = async (
    {
        orgId,
        courseId,
        materialId
    },
    { session = null } = {}
) => {
    let query = CourseMaterial.findOneAndUpdate(
        {
            _id: materialId,
            org: orgId,
            course: courseId,
            status: "active"
        },
        {
            $set: {
                status: "archived"
            }
        },
        {
            returnDocument: "after",
            runValidators: true
        }
    );

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};