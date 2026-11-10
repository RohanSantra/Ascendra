import CourseMaterialUploadIntent from "./courseMaterialUploadIntent.model.js";


/**
 * Creates a new course material upload intent.
 *
 * @param {Object} intentData
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 * @returns {Promise<Object>}
 */
export const createCourseMaterialUploadIntent = async (
    intentData,
    { session = null } = {}
) => {
    const [intent] = await CourseMaterialUploadIntent.create(
        [intentData],
        { session }
    );

    return intent;
};


/**
 * Retrieves a pending upload intent scoped to its organisation,
 * course, uploader and Cloudinary public ID.
 *
 * Expired intents are not returned, even if MongoDB's TTL
 * background cleanup has not removed them yet.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.userId
 * @param {string} params.publicId
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 * @returns {Promise<Object|null>}
 */
export const getPendingCourseMaterialUploadIntent = async (
    {
        orgId,
        courseId,
        userId,
        publicId
    },
    { session = null } = {}
) => {
    let query = CourseMaterialUploadIntent.findOne({
        org: orgId,
        course: courseId,
        uploadedBy: userId,
        publicId,
        status: "pending",
        expiresAt: { $gt: new Date() }
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};


/**
 * Atomically consumes a pending upload intent.
 *
 * The conditional update prevents concurrent confirmation
 * requests from consuming the same intent more than once.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.userId
 * @param {string} params.publicId
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 * @returns {Promise<Object|null>}
 */
export const consumeCourseMaterialUploadIntent = async (
    {
        orgId,
        courseId,
        userId,
        publicId
    },
    { session = null } = {}
) => {
    const now = new Date();

    let query = CourseMaterialUploadIntent.findOneAndUpdate(
        {
            org: orgId,
            course: courseId,
            uploadedBy: userId,
            publicId,
            status: "pending",
            expiresAt: { $gt: now }
        },
        {
            $set: {
                status: "consumed",
                consumedAt: now
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
 * Deletes an upload intent by its public ID and ownership scope.
 *
 * Useful for explicitly cleaning up an abandoned intent.
 *
 * @param {Object} params
 * @param {string} params.orgId
 * @param {string} params.courseId
 * @param {string} params.userId
 * @param {string} params.publicId
 * @param {Object} options
 * @param {import("mongoose").ClientSession|null} options.session
 * @returns {Promise<Object|null>}
 */
export const deleteCourseMaterialUploadIntent = async (
    {
        orgId,
        courseId,
        userId,
        publicId
    },
    { session = null } = {}
) => {
    let query = CourseMaterialUploadIntent.findOneAndDelete({
        org: orgId,
        course: courseId,
        uploadedBy: userId,
        publicId
    });

    if (session) {
        query = query.session(session);
    }

    return query.lean();
};