import LearningProgress from "./learningProgress.model.js";
import CourseMaterial from "../courseMaterials/courseMaterial.model.js";


/**
 * Creates a learning progress record.
 *
 * @param {Object} progressData - Learning progress document data.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} Created learning progress record.
 */
export const createLearningProgress = async (
    progressData,
    { session = null } = {}
) => {
    const [progress] = await LearningProgress.create(
        [progressData],
        { session }
    );

    return progress;
};


/**
 * Retrieves learning progress for a specific trainee and material.
 *
 * @param {Object} params - Progress lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {string} params.materialId - Course material ID.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Matching progress record.
 */
export const getLearningProgressByMaterial = async ({
    orgId,
    courseId,
    traineeId,
    materialId
}, {
    session = null
} = {}) => {
    return LearningProgress.findOne({
        org: orgId,
        course: courseId,
        trainee: traineeId,
        material: materialId
    })
        .session(session)
        .lean();
};


/**
 * Retrieves a learning progress record by its identifier.
 *
 * @param {Object} params - Progress lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.progressId - Learning progress ID.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Matching progress record.
 */
export const getLearningProgressById = async ({
    orgId,
    progressId
}, {
    session = null
} = {}) => {
    return LearningProgress.findOne({
        _id: progressId,
        org: orgId
    })
        .session(session)
        .lean();
};


/**
 * Creates a progress record if one does not already exist.
 *
 * The unique compound index on organisation, course, trainee
 * and material protects against duplicate records.
 *
 * @param {Object} params - Progress creation parameters.
 * @param {Object} params.progressData - Progress document data.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} Existing or newly created progress record.
 */
export const getOrCreateLearningProgress = async ({
    progressData
}, {
    session = null
} = {}) => {
    return LearningProgress.findOneAndUpdate(
        {
            org: progressData.org,
            course: progressData.course,
            trainee: progressData.trainee,
            material: progressData.material
        },
        {
            $setOnInsert: progressData
        },
        {
            returnDocument: "after",
            upsert: true,
            setDefaultsOnInsert: true,
            runValidators: true,
            session
        }
    ).lean();
};


/**
 * Retrieves learning progress records using organisation-scoped filters.
 *
 * @param {Object} params - Progress listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {Object} [params.filters={}] - Additional query filters.
 * @param {Object} [params.pagination={}] - Pagination configuration.
 * @param {Object} [params.sort={}] - Sorting configuration.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} Progress records and pagination metadata.
 */
export const getLearningProgressRecords = async ({
    orgId,
    courseId,
    filters = {},
    pagination = {},
    sort = {}
}, {
    session = null
} = {}) => {
    const query = {
        org: orgId,
        course: courseId
    };

    if (filters.traineeId) {
        query.trainee = filters.traineeId;
    }

    if (filters.status) {
        query.status = filters.status;
    }

    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "startedAt",
        "lastAccessedAt",
        "completedAt"
    ];

    const sortBy = allowedSortFields.includes(sort.sortBy)
        ? sort.sortBy
        : "updatedAt";

    const sortOrder = sort.sortOrder === "asc" ? 1 : -1;

    const [data, total] = await Promise.all([
        LearningProgress.find(query)
            .sort({
                [sortBy]: sortOrder
            })
            .skip(skip)
            .limit(limit)
            .session(session)
            .lean(),

        LearningProgress.countDocuments(query).session(session)
    ]);

    return {
        data,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};


/**
 * Retrieves a trainee's course-level learning progress summary.
 *
 * Only active course materials are included in the calculation.
 * Materials without a progress record are counted as not started.
 *
 * @param {Object} params - Progress summary parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} Course-level progress summary.
 */
export const getLearningProgressSummary = async ({
    orgId,
    courseId,
    traineeId
}, {
    session = null
} = {}) => {
    // Retrieve active course materials.
    const activeMaterialIds = await CourseMaterial.distinct("_id", {
        org: orgId,
        course: courseId,
        status: "active"
    }).session(session);

    const totalMaterials = activeMaterialIds.length;

    // No active materials means there is no progress to calculate.
    if (totalMaterials === 0) {
        return {
            totalMaterials: 0,
            completedMaterials: 0,
            inProgressMaterials: 0,
            notStartedMaterials: 0,
            completionPercentage: 0
        };
    }

    const progressQuery = {
        org: orgId,
        course: courseId,
        trainee: traineeId,
        material: {
            $in: activeMaterialIds
        }
    };

    // Count completed and in-progress materials.
    const [completedMaterials, inProgressMaterials] = await Promise.all([
        LearningProgress.countDocuments({
            ...progressQuery,
            status: "completed"
        }).session(session),

        LearningProgress.countDocuments({
            ...progressQuery,
            status: "in_progress"
        }).session(session)
    ]);

    const notStartedMaterials = Math.max(
        0,
        totalMaterials - completedMaterials - inProgressMaterials
    );

    const completionPercentage = Number(
        ((completedMaterials / totalMaterials) * 100).toFixed(2)
    );

    return {
        totalMaterials,
        completedMaterials,
        inProgressMaterials,
        notStartedMaterials,
        completionPercentage
    };
};


/**
 * Updates a trainee's learning progress.
 *
 * Completed records cannot be moved backwards to an earlier status.
 * The operation is scoped to the organisation, course, trainee
 * and material.
 *
 * @param {Object} params - Progress update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {string} params.materialId - Course material ID.
 * @param {Object} params.updates - Fields to update.
 * @param {Object} options - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Updated progress record.
 */
export const updateLearningProgress = async ({
    orgId,
    courseId,
    traineeId,
    materialId,
    updates
}, {
    session = null
} = {}) => {
    return LearningProgress.findOneAndUpdate(
        {
            org: orgId,
            course: courseId,
            trainee: traineeId,
            material: materialId,
            status: {
                $ne: "completed"
            }
        },
        {
            $set: updates
        },
        {
            returnDocument: "after",
            runValidators: true,
            session
        }
    ).lean();
};