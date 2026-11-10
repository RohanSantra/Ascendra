import Feedback from "./feedback.model.js";


/**
 * Creates a feedback record.
 *
 * @param {Object} feedbackData - Feedback information.
 * @param {Object} options - Database operation options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object>} Created feedback record.
 */
export const createFeedback = async (
    feedbackData,
    { session = null } = {}
) => {
    const [feedback] = await Feedback.create(
        [feedbackData],
        { session }
    );

    return feedback;
};


/**
 * Retrieves feedback by its identifier within an organisation.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.feedbackId - Feedback identifier.
 * @param {Object} options - Query options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Feedback record or null.
 */
export const getFeedbackById = async (
    { orgId, feedbackId },
    { session = null } = {}
) => {
    return Feedback.findOne({
        _id: feedbackId,
        org: orgId
    })
        .session(session)
        .lean();
};


/**
 * Retrieves a trainee's feedback for a specific course.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.courseId - Course identifier.
 * @param {string} params.traineeId - Trainee identifier.
 * @param {Object} options - Query options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Feedback record or null.
 */
export const getFeedbackByCourseAndTrainee = async (
    { orgId, courseId, traineeId },
    { session = null } = {}
) => {
    return Feedback.findOne({
        org: orgId,
        course: courseId,
        trainee: traineeId
    })
        .session(session)
        .lean();
};


/**
 * Retrieves feedback records using organisation-scoped filters.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {Object} params.filters - Optional query filters.
 * @param {Object} params.pagination - Pagination settings.
 * @param {Object} params.sort - Sorting settings.
 * @returns {Promise<Object>} Feedback records and pagination metadata.
 */
export const getFeedbackRecords = async ({
    orgId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    const {
        courseId,
        trainerId,
        traineeId,
        status
    } = filters;

    const {
        page = 1,
        limit = 20
    } = pagination;

    const {
        sortBy = "createdAt",
        sortOrder = "desc"
    } = sort;

    const query = {
        org: orgId
    };

    if (courseId) {
        query.course = courseId;
    }

    if (trainerId) {
        query.trainer = trainerId;
    }

    if (traineeId) {
        query.trainee = traineeId;
    }

    if (status) {
        query.status = status;
    }

    const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "rating"
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";

    const safeSortOrder = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Feedback.find(query)
            .populate("trainee", "firstName lastName email")
            .populate("trainer", "firstName lastName email")
            .populate("course", "title status")
            .sort({
                [safeSortBy]: safeSortOrder,
                _id: safeSortOrder
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        Feedback.countDocuments(query)
    ]);

    return {
        data,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};


/**
 * Updates feedback visibility within an organisation.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.feedbackId - Feedback identifier.
 * @param {Object} params.updates - Allowed feedback updates.
 * @param {Object} options - Query options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Updated feedback or null.
 */
export const updateFeedback = async (
    { orgId, feedbackId, updates },
    { session = null } = {}
) => {
    return Feedback.findOneAndUpdate(
        {
            _id: feedbackId,
            org: orgId
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