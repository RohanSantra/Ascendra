import mongoose from "mongoose";
import Assessment from "./assessment.model.js";


/**
 * Creates a new assessment document.
 *
 * @param {Object} assessmentData - Assessment data.
 * @param {Object} [options={}] - Database options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} Created assessment.
 */
export const createAssessment = async (
    assessmentData,
    { session = null } = {}
) => {
    const [assessment] = await Assessment.create(
        [assessmentData],
        { session }
    );

    return assessment;
};


/**
 * Retrieves an assessment within an organisation.
 *
 * Correct answers are excluded by default because the question schema
 * marks correctOptionId as select:false.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {Object} [options={}] - Query options.
 * @param {boolean} [options.includeCorrectAnswers=false] - Include answer keys.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Assessment or null.
 */
export const getAssessmentById = async (
    {
        orgId,
        assessmentId
    },
    {
        includeCorrectAnswers = false,
        session = null
    } = {}
) => {
    let query = Assessment.findOne({
        _id: assessmentId,
        org: orgId
    });

    if (includeCorrectAnswers) {
        query = query.select("+questions.correctOptionId");
    }

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves an assessment associated with a specific course.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {Object} [options={}] - Query options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Assessment or null.
 */
export const getAssessmentByCourse = async (
    {
        orgId,
        courseId,
        assessmentId
    },
    {
        session = null
    } = {}
) => {
    let query = Assessment.findOne({
        _id: assessmentId,
        org: orgId,
        course: courseId
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves a specific assessment version.
 *
 * When assessmentKey is supplied, the lookup is restricted to that
 * assessment series. This prevents different assessments in the same
 * course from sharing a version history.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.version - Version number.
 * @param {string} [params.assessmentKey] - Assessment series identifier.
 * @param {Object} [options={}] - Query options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Assessment version or null.
 */
export const getAssessmentByVersion = async (
    {
        orgId,
        courseId,
        version,
        assessmentKey
    },
    {
        session = null
    } = {}
) => {
    const filters = {
        org: orgId,
        course: courseId,
        version
    };

    if (assessmentKey) {
        filters.assessmentKey = assessmentKey;
    }

    let query = Assessment.findOne(filters);

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves the latest version belonging to an assessment series.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.courseId - Course ID.
 * @param {string} params.assessmentKey - Assessment series identifier.
 * @param {Object} [options={}] - Query options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Latest assessment version or null.
 */
export const getLatestAssessmentVersion = async (
    {
        orgId,
        courseId,
        assessmentKey
    },
    {
        session = null
    } = {}
) => {
    let query = Assessment.findOne({
        org: orgId,
        course: courseId,
        assessmentKey
    }).sort({
        version: -1
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves assessments using organisation-scoped filters and pagination.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} [params.courseId] - Optional course ID.
 * @param {Object} [params.filters={}] - Assessment filters.
 * @param {Object} [params.pagination={}] - Pagination configuration.
 * @param {Object} [params.sort={}] - Sorting configuration.
 * @returns {Promise<Object>} Assessment records and pagination metadata.
 */
export const getAssessments = async ({
    orgId,
    courseId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    const query = {
        org: orgId
    };

    if (courseId) {
        query.course = courseId;
    }

    if (filters.status) {
        query.status = filters.status;
    }

    const page = Math.max(
        1,
        Number(pagination.page) || 1
    );

    const limit = Math.min(
        100,
        Math.max(1, Number(pagination.limit) || 20)
    );

    const skip = (page - 1) * limit;

    const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "title",
        "version",
        "publishedAt"
    ];

    const sortBy = allowedSortFields.includes(sort.sortBy)
        ? sort.sortBy
        : "createdAt";

    const sortOrder = sort.sortOrder === "asc"
        ? 1
        : -1;

    const sortOptions = {
        [sortBy]: sortOrder,
        _id: sortOrder
    };

    const [data, total] = await Promise.all([
        Assessment.find(query)
            .select("-questions.correctOptionId")
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean(),

        Assessment.countDocuments(query)
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
 * Updates a draft assessment using optimistic concurrency.
 *
 * The update succeeds only when the document is still a draft and
 * its version key matches the value originally retrieved.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {number} params.expectedVersionKey - Expected __v value.
 * @param {Object} params.updates - Fields to update.
 * @param {Object} [options={}] - Query options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Updated assessment or null.
 */
export const updateAssessment = async (
    {
        orgId,
        assessmentId,
        expectedVersionKey,
        updates
    },
    {
        session = null
    } = {}
) => {
    let query = Assessment.findOneAndUpdate(
        {
            _id: assessmentId,
            org: orgId,
            status: "draft",
            __v: expectedVersionKey
        },
        {
            $set: updates,
            $inc: {
                __v: 1
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


/**
 * Publishes a draft assessment and archives the previous published
 * version in the same assessment series.
 *
 * Both changes execute in one MongoDB transaction. If publication
 * fails, the previous published version remains unchanged.
 *
 * @param {Object} params - Publication parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {number} params.expectedVersionKey - Expected __v value.
 * @returns {Promise<Object|null>} Published assessment or null.
 */
export const publishAssessment = async ({
    orgId,
    assessmentId,
    expectedVersionKey
}) => {
    const session = await mongoose.startSession();

    let publishedAssessment = null;

    try {
        await session.withTransaction(async () => {
            const draft = await Assessment.findOne({
                _id: assessmentId,
                org: orgId,
                status: "draft",
                __v: expectedVersionKey
            }).session(session);

            if (!draft) {
                return;
            }

            await Assessment.updateMany(
                {
                    org: orgId,
                    course: draft.course,
                    assessmentKey: draft.assessmentKey,
                    status: "published"
                },
                {
                    $set: {
                        status: "archived"
                    },
                    $inc: {
                        __v: 1
                    }
                },
                {
                    session,
                    runValidators: true
                }
            );

            publishedAssessment = await Assessment.findOneAndUpdate(
                {
                    _id: assessmentId,
                    org: orgId,
                    status: "draft",
                    __v: expectedVersionKey
                },
                {
                    $set: {
                        status: "published",
                        publishedAt: new Date()
                    },
                    $inc: {
                        __v: 1
                    }
                },
                {
                    returnDocument: "after",
                    runValidators: true,
                    session
                }
            ).lean();

            if (!publishedAssessment) {
                throw new Error(
                    "ASSESSMENT_PUBLICATION_CONFLICT"
                );
            }
        });

        return publishedAssessment;
    } catch (error) {
        if (
            error.message === "ASSESSMENT_PUBLICATION_CONFLICT"
        ) {
            return null;
        }

        throw error;
    } finally {
        await session.endSession();
    }
};


/**
 * Archives a published assessment.
 *
 * @param {Object} params - Archive parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {number} params.expectedVersionKey - Expected __v value.
 * @param {Object} [options={}] - Query options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Archived assessment or null.
 */
export const archiveAssessment = async (
    {
        orgId,
        assessmentId,
        expectedVersionKey
    },
    {
        session = null
    } = {}
) => {
    let query = Assessment.findOneAndUpdate(
        {
            _id: assessmentId,
            org: orgId,
            status: "published",
            __v: expectedVersionKey
        },
        {
            $set: {
                status: "archived"
            },
            $inc: {
                __v: 1
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