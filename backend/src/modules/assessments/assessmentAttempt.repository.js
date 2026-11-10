import AssessmentAttempt from "./assessmentAttempt.model.js";


/**
 * Creates a new assessment attempt.
 *
 * The attempt includes a snapshot of the assessment version
 * used when the trainee started.
 *
 * @param {Object} attemptData - Assessment attempt document data.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} Created assessment attempt.
 */
export const createAssessmentAttempt = async (
    attemptData,
    { session = null } = {}
) => {
    const [attempt] = await AssessmentAttempt.create(
        [attemptData],
        { session }
    );

    return attempt;
};


/**
 * Retrieves an assessment attempt by ID within an organisation.
 *
 * The immutable snapshot is excluded by default. It can be explicitly
 * included for trusted server-side operations such as grading.
 *
 * @param {Object} params - Attempt lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Assessment attempt ID.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @param {boolean} [options.includeSnapshot=false] - Whether to include the snapshot.
 * @returns {Promise<Object|null>} Assessment attempt or null.
 */
export const getAssessmentAttemptById = async (
    {
        orgId,
        attemptId
    },
    {
        session = null,
        includeSnapshot = false
    } = {}
) => {
    let query = AssessmentAttempt.findOne({
        _id: attemptId,
        org: orgId
    });

    if (includeSnapshot) {
        query = query.select(
            "+assessmentSnapshot +assessmentSnapshot.questions.correctOptionId"
        );
    }

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves an attempt belonging to a specific assessment and trainee.
 *
 * @param {Object} params - Attempt lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {number} params.attemptNumber - Attempt number.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @param {boolean} [options.includeSnapshot=false] - Whether to include the snapshot.
 * @returns {Promise<Object|null>} Assessment attempt or null.
 */
export const getAssessmentAttemptByNumber = async (
    {
        orgId,
        assessmentId,
        traineeId,
        attemptNumber
    },
    {
        session = null,
        includeSnapshot = false
    } = {}
) => {
    let query = AssessmentAttempt.findOne({
        org: orgId,
        assessment: assessmentId,
        trainee: traineeId,
        attemptNumber
    });

    if (includeSnapshot) {
        query = query.select(
            "+assessmentSnapshot +assessmentSnapshot.questions.correctOptionId"
        );
    }

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Retrieves the latest in-progress attempt for an assessment and trainee.
 *
 * @param {Object} params - Attempt lookup parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @param {boolean} [options.includeSnapshot=false] - Whether to include the snapshot.
 * @returns {Promise<Object|null>} In-progress attempt or null.
 */
export const getInProgressAssessmentAttempt = async (
    {
        orgId,
        assessmentId,
        traineeId
    },
    {
        session = null,
        includeSnapshot = false
    } = {}
) => {
    let query = AssessmentAttempt.findOne({
        org: orgId,
        assessment: assessmentId,
        trainee: traineeId,
        status: "in_progress"
    }).sort({
        createdAt: -1
    });

    if (includeSnapshot) {
        query = query.select(
            "+assessmentSnapshot +assessmentSnapshot.questions.correctOptionId"
        );
    }

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Counts all attempts made by a trainee for an assessment.
 *
 * Expired and submitted attempts are included because they
 * consume an attempt under the assessment attempt policy.
 *
 * @param {Object} params - Attempt count parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.assessmentId - Assessment ID.
 * @param {string} params.traineeId - Trainee user ID.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<number>} Number of attempts.
 */
export const countAssessmentAttempts = async (
    {
        orgId,
        assessmentId,
        traineeId
    },
    {
        session = null
    } = {}
) => {
    let query = AssessmentAttempt.countDocuments({
        org: orgId,
        assessment: assessmentId,
        trainee: traineeId
    });

    if (session) {
        query = query.session(session);
    }

    return query;
};


/**
 * Retrieves assessment attempts within an organisation.
 *
 * Snapshot data and correct answers are never included in list results.
 *
 * @param {Object} params - Attempt listing parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} [params.assessmentId] - Optional assessment filter.
 * @param {string} [params.courseId] - Optional course filter.
 * @param {string} [params.traineeId] - Optional trainee filter.
 * @param {Object} [params.filters={}] - Attempt filters.
 * @param {Object} [params.pagination={}] - Pagination configuration.
 * @param {Object} [params.sort={}] - Sorting configuration.
 * @returns {Promise<Object>} Attempt records and pagination metadata.
 */
export const getAssessmentAttempts = async ({
    orgId,
    assessmentId,
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
        sortBy = "createdAt",
        sortOrder = "desc"
    } = sort;

    const query = {
        org: orgId
    };

    if (assessmentId) {
        query.assessment = assessmentId;
    }

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
        "createdAt",
        "updatedAt",
        "startedAt",
        "submittedAt",
        "evaluatedAt",
        "attemptNumber",
        "percentage",
        "score"
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";

    const safeSortOrder = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [attempts, total] = await Promise.all([
        AssessmentAttempt.find(query)
            .sort({
                [safeSortBy]: safeSortOrder,
                _id: -1
            })
            .skip(skip)
            .limit(limit)
            .populate({
                path: "trainee",
                select: "firstName lastName email"
            })
            .select("-assessmentSnapshot")
            .lean(),

        AssessmentAttempt.countDocuments(query)
    ]);

    return {
        data: attempts,

        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
};


/**
 * Atomically saves trainee answers for an in-progress attempt.
 *
 * Existing answers for submitted question IDs are replaced.
 * Answers for all other questions are preserved.
 *
 * The operation only succeeds while the attempt is in progress
 * and has not expired. This prevents answer changes after submission
 * or expiry.
 *
 * A MongoDB update pipeline performs the merge in one database
 * operation, avoiding stale read-modify-write overwrites.
 *
 * @param {Object} params - Answer-saving parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Assessment attempt ID.
 * @param {Array<Object>} params.answers - Answers to save.
 * @param {Date} [params.now=new Date()] - Expiry comparison time.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Updated attempt or null.
 */
export const saveAssessmentAnswers = async (
    {
        orgId,
        attemptId,
        answers,
        now = new Date()
    },
    {
        session = null
    } = {}
) => {
    if (!Array.isArray(answers) || answers.length === 0) {
        return null;
    }

    const questionIds = answers.map(
        (answer) => answer.questionId
    );

    const query = {
        _id: attemptId,
        org: orgId,
        status: "in_progress",
        expiresAt: {
            $gt: now
        }
    };

    return AssessmentAttempt.findOneAndUpdate(
        query,
        [
            {
                $set: {
                    answers: {
                        $concatArrays: [
                            {
                                $filter: {
                                    input: {
                                        $ifNull: [
                                            "$answers",
                                            []
                                        ]
                                    },
                                    as: "existingAnswer",
                                    cond: {
                                        $not: [
                                            {
                                                $in: [
                                                    "$$existingAnswer.questionId",
                                                    {
                                                        $literal: questionIds
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                $literal: answers
                            }
                        ]
                    }
                }
            }
        ],
        {
            returnDocument: "after",
            session,
            updatePipeline: true
        }
    ).lean();
};


/**
 * Atomically updates an assessment attempt.
 *
 * The expected status prevents conflicting lifecycle transitions.
 * An optional expiry condition prevents updates to overdue attempts.
 *
 * This method can also transition an attempt from "in_progress"
 * to "submitted", which locks its answers before evaluation.
 *
 * @param {Object} params - Attempt update parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {string} params.attemptId - Assessment attempt ID.
 * @param {string} params.expectedStatus - Expected current status.
 * @param {Object} params.updates - Allowlisted updates.
 * @param {boolean} [params.requireUnexpired=false] - Require an unexpired attempt.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object|null>} Updated attempt or null.
 */
export const updateAssessmentAttempt = async (
    {
        orgId,
        attemptId,
        expectedStatus,
        updates,
        requireUnexpired = false
    },
    {
        session = null
    } = {}
) => {
    const query = {
        _id: attemptId,
        org: orgId,
        status: expectedStatus
    };

    if (requireUnexpired) {
        query.expiresAt = {
            $gt: new Date()
        };
    }

    return AssessmentAttempt.findOneAndUpdate(
        query,
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


/**
 * Marks overdue in-progress attempts as expired.
 *
 * This operation does not delete attempt records or snapshots.
 * Expired attempts remain available for reporting and audit history.
 *
 * @param {Object} params - Expiry parameters.
 * @param {string} params.orgId - Organisation ID.
 * @param {Date} [params.now=new Date()] - Expiry cutoff time.
 * @param {Object} [options={}] - Database operation options.
 * @param {Object|null} [options.session=null] - MongoDB session.
 * @returns {Promise<Object>} MongoDB update result.
 */
export const expireAssessmentAttempts = async (
    {
        orgId,
        now = new Date()
    },
    {
        session = null
    } = {}
) => {
    return AssessmentAttempt.updateMany(
        {
            org: orgId,
            status: "in_progress",
            expiresAt: {
                $lte: now
            }
        },
        {
            $set: {
                status: "expired"
            }
        },
        {
            runValidators: true,
            session
        }
    );
}; 