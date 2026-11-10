import Announcement from "./announcement.model.js";


/**
 * Creates an announcement.
 *
 * @param {Object} announcementData - Announcement information.
 * @param {Object} options - Database operation options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object>} Created announcement.
 */
export const createAnnouncement = async (
    announcementData,
    { session = null } = {}
) => {
    const [announcement] = await Announcement.create(
        [announcementData],
        { session }
    );

    return announcement;
};


/**
 * Retrieves an announcement by identifier within an organisation.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.announcementId - Announcement identifier.
 * @param {Object} options - Query options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Announcement or null.
 */
export const getAnnouncementById = async (
    { orgId, announcementId },
    { session = null } = {}
) => {
    return Announcement.findOne({
        _id: announcementId,
        org: orgId
    })
        .session(session)
        .populate("createdBy", "firstName lastName email")
        .populate("updatedBy", "firstName lastName email")
        .lean();
};


/**
 * Retrieves announcements using organisation-scoped filters.
 *
 * @param {Object} params - Query parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {Object} params.filters - Optional filters.
 * @param {Object} params.pagination - Pagination settings.
 * @param {Object} params.sort - Sorting settings.
 * @returns {Promise<Object>} Announcements and pagination metadata.
 */
export const getAnnouncements = async ({
    orgId,
    filters = {},
    pagination = {},
    sort = {}
}) => {
    const {
        status,
        audience
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

    if (status) {
        query.status = status;
    }

    if (audience) {
        query.audience = audience;
    }

    const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "publishedAt",
        "title"
    ];

    const safeSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";

    const safeSortOrder = sortOrder === "asc" ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        Announcement.find(query)
            .populate("createdBy", "firstName lastName")
            .sort({
                [safeSortBy]: safeSortOrder,
                _id: safeSortOrder
            })
            .skip(skip)
            .limit(limit)
            .lean(),

        Announcement.countDocuments(query)
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
 * Updates an announcement within an organisation.
 *
 * @param {Object} params - Update parameters.
 * @param {string} params.orgId - Organisation identifier.
 * @param {string} params.announcementId - Announcement identifier.
 * @param {Object} params.updates - Fields to update.
 * @param {Object} options - Query options.
 * @param {Object|null} options.session - Optional MongoDB session.
 * @returns {Promise<Object|null>} Updated announcement or null.
 */
export const updateAnnouncement = async (
    { orgId, announcementId, updates },
    { session = null } = {}
) => {
    return Announcement.findOneAndUpdate(
        {
            _id: announcementId,
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
    )
        .lean();
};