import Enrollment from "./enrollment.model.js";


/**
 * Creates a course enrollment record.
 *
 * @param {Object} enrollmentData - Enrollment data to persist.
 * @param {Object} options - Repository options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object>} Created enrollment document.
 */
export const createEnrollment = async (
    enrollmentData,
    { session = null } = {}
) => {
    const [enrollment] = await Enrollment.create(
        [enrollmentData],
        { session }
    );

    return enrollment;
};


/**
 * Retrieves an enrollment by its ID within an organisation.
 *
 * Populates the trainee's basic account information.
 *
 * @param {Object} params - Enrollment lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.enrollmentId - Enrollment ID.
 * @param {Object} options - Repository options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Enrollment or null.
 */
export const getEnrollmentById = async (
    { orgId, enrollmentId },
    { session = null } = {}
) => {
    let query = Enrollment.findOne({
        _id: enrollmentId,
        org: orgId
    }).populate({
        path: "trainee",
        select: "firstName lastName email"
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves an enrollment for a specific trainee and course.
 *
 * @param {Object} params - Enrollment lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {Object} options - Repository options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Enrollment or null.
 */
export const getEnrollmentByCourseAndTrainee = async (
    { orgId, courseId, traineeId },
    { session = null } = {}
) => {
    let query = Enrollment.findOne({
        org: orgId,
        course: courseId,
        trainee: traineeId
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves enrollments within an organisation.
 *
 * Supports optional course and trainee filters,
 * enrollment status filtering, sorting and pagination.
 *
 * @param {Object} params - Enrollment query parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} [params.courseId] - Optional course ID.
 * @param {string} [params.traineeId] - Optional trainee ID.
 * @param {Object} [params.filters={}] - Enrollment filters.
 * @param {Object} [params.pagination={}] - Pagination settings.
 * @param {Object} [params.sort={}] - Sorting settings.
 * @returns {Promise<Object>} Enrollment records and pagination metadata.
 */
export const getEnrollments = async ({
    orgId,
    courseId,
    traineeId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    const {
        status
    } = filters;

    const {
        page = 1,
        limit = 20
    } = pagination;

    const {
        sortBy = "enrolledAt",
        sortOrder = "desc"
    } = sort;

    const query = {
        org: orgId
    };

    if (courseId) {
        query.course = courseId;
    }

    if (traineeId) {
        query.trainee = traineeId;
    }

    if (status) {
        query.status = status;
    }

    const allowedSortFields = [
        "enrolledAt",
        "createdAt",
        "updatedAt",
        "startedAt",
        "completedAt"
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "enrolledAt";

    const safeSortOrder = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Enrollment.find(query)
            .populate({
                path: "trainee",
                select: "firstName lastName email"
            })
            .sort({
                [safeSortBy]: safeSortOrder,
                _id: -1
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        Enrollment.countDocuments(query)
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
 * Updates an enrollment only if its current status
 * matches the expected status.
 *
 * This conditional update prevents concurrent requests
 * from applying conflicting lifecycle transitions.
 *
 * @param {Object} params - Enrollment update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.enrollmentId - Enrollment ID.
 * @param {string} params.expectedStatus - Expected current status.
 * @param {Object} params.updates - Fields to update.
 * @param {Object} options - Repository options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Updated enrollment or null.
 */
export const updateEnrollment = async (
    {
        orgId,
        enrollmentId,
        expectedStatus,
        updates
    },
    { session = null } = {}
) => {
    return Enrollment.findOneAndUpdate(
        {
            _id: enrollmentId,
            org: orgId,
            status: expectedStatus
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