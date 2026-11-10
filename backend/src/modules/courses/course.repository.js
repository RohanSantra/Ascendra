
import Course from "./course.model.js";

/**
 * Creates a new course.
 *
 * Database insertion only. Assignment verification and business
 * validation must be performed by the service before this call.
 *
 * @param {Object} courseData
 * @param {Object} options
 * @param {Object|null} options.session
 * @returns {Promise<Object>}
 */
export const createCourse = async (
    courseData,
    { session = null } = {}
) => {
    const course = new Course(courseData);

    return course.save({ session });
};

/**
 * Retrieves a course by ID within an organisation.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {Object|null} params.session
 * @returns {Promise<Object|null>}
 */
export const getCourseById = async ({
    orgId,
    courseId,
    session = null
}) => {
    return Course.findOne({
        _id: courseId,
        org: orgId
    })
        .session(session)
        .populate("trainer", "firstName lastName email")
        .populate(
            "trainerProfile",
            "professionalDetails.headline"
        )
        .populate(
            "trainerAssignment",
            "status startDate endDate"
        )
        .populate("requirement", "title status")
        .lean();
};

/**
 * Retrieves a course using its trainer assignment.
 *
 * The organisation condition prevents cross-organisation access.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.trainerAssignmentId
 * @param {Object|null} params.session
 * @returns {Promise<Object|null>}
 */
export const getCourseByTrainerAssignment = async ({
    orgId,
    trainerAssignmentId,
    session = null
}) => {
    return Course.findOne({
        org: orgId,
        trainerAssignment: trainerAssignmentId
    })
        .session(session)
        .lean();
};

/**
 * Retrieves courses belonging to an organisation.
 *
 * Supports optional status and trainer filters, pagination
 * and controlled sorting.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {Object} params.filters
 * @param {string} [params.filters.status]
 * @param {string} [params.filters.trainerId]
 * @param {Object} params.pagination
 * @param {number} params.pagination.page
 * @param {number} params.pagination.limit
 * @param {Object} params.sort
 * @param {string} params.sort.sortBy
 * @param {string} params.sort.sortOrder
 * @returns {Promise<Object>}
 */
export const getCourses = async ({
    orgId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    const {
        status,
        trainerId
    } = filters;

    const {
        page = 1,
        limit = 10
    } = pagination;

    const {
        sortBy = "createdAt",
        sortOrder = "desc"
    } = sort;

    const query = {
        org: orgId
    };

    if (status) {
        query.status = status;
    }

    if (trainerId) {
        query.trainer = trainerId;
    }

    const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "startDate",
        "endDate",
        "title"
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";

    const safeSortOrder = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [courses, total] = await Promise.all([
        Course.find(query)
            .sort({
                [safeSortBy]: safeSortOrder,
                _id: 1
            })
            .skip(skip)
            .limit(limit)
            .populate("trainer", "firstName lastName email")
            .populate(
                "trainerProfile",
                "professionalDetails.headline"
            )
            .populate("requirement", "title status")
            .lean(),

        Course.countDocuments(query)
    ]);

    return {
        courses,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Updates permitted course information.
 *
 * The service must restrict the supplied update fields.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {Object} params.updates
 * @param {Object|null} params.session
 * @returns {Promise<Object|null>}
 */
export const updateCourse = async ({
    orgId,
    courseId,
    updates,
    session = null
}) => {
    return Course.findOneAndUpdate(
        {
            _id: courseId,
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
    );
};

/**
 * Updates a course lifecycle status.
 *
 * Allowed transitions must be enforced by the service.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.status
 * @param {Object|null} params.session
 * @returns {Promise<Object|null>}
 */
export const updateCourseStatus = async ({
    orgId,
    courseId,
    status,
    session = null
}) => {
    return Course.findOneAndUpdate(
        {
            _id: courseId,
            org: orgId
        },
        {
            $set: { status }
        },
        {
            returnDocument: "after",
            runValidators: true,
            session
        }
    );
};
