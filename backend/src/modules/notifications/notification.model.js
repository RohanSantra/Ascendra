import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Stores notifications delivered to organisation members.
 *
 * Each notification belongs to an organisation and a recipient.
 * The initial implementation supports in-app notifications,
 * unread/read states and basic notification categories.
 *
 * Additional delivery channels and resource types can be
 * introduced later without changing the core notification structure.
 *
 * @name Notification
 */
const notificationSchema = new Schema(
    {
        /**
         * Organisation that owns the notification.
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            immutable: true
        },

        /**
         * User who receives the notification.
         */
        recipient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true
        },

        /**
         * User or system actor responsible for the event.
         */
        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        /**
         * Notification category.
         *
         * The initial implementation uses the basic events
         * required by Ascendra.
         */
        type: {
            type: String,
            enum: [
                "announcement_published",
                "course_assigned",
                "enrollment_updated",
                "assessment_available",
                "assessment_evaluated",
                "general"
            ],
            default: "general",
            required: true
        },

        /**
         * Short notification heading.
         */
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 200
        },

        /**
         * Notification message.
         */
        message: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 1000
        },

        /**
         * Optional linked resource.
         *
         * Identifies the related announcement, course,
         * enrolment, assessment or other resource.
         */
        resource: {
            type: {
                type: String,
                enum: [
                    "announcement",
                    "course",
                    "enrollment",
                    "assessment",
                    "assessment_attempt",
                    "other"
                ],
                default: null
            },

            id: {
                type: Schema.Types.ObjectId,
                default: null
            }
        },

        /**
         * Notification delivery channels.
         *
         * Only in_app is used by the initial implementation.
         * Additional channels are reserved for future extensions.
         */
        channels: {
            type: [{
                type: String,
                enum: [
                    "in_app",
                    "email",
                    "push"
                ]
            }],
            default: ["in_app"]
        },

        /**
         * Notification lifecycle status.
         */
        status: {
            type: String,
            enum: [
                "unread",
                "read",
                "archived"
            ],
            default: "unread",
            required: true
        },

        /**
         * Date when the recipient read the notification.
         */
        readAt: {
            type: Date,
            default: null
        },

        /**
         * Optional notification expiry date.
         */
        expiresAt: {
            type: Date,
            default: null
        },

        /**
         * Additional structured event information.
         *
         * Reserved for future notification enhancements.
         */
        metadata: {
            type: Schema.Types.Mixed,
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);


/**
 * Supports retrieving notifications for a recipient,
 * ordered by their creation date.
 */
notificationSchema.index({
    org: 1,
    recipient: 1,
    createdAt: -1
});


/**
 * Supports unread notification counts and filtering.
 */
notificationSchema.index({
    org: 1,
    recipient: 1,
    status: 1,
    createdAt: -1
});


/**
 * Supports retrieving notifications by category.
 */
notificationSchema.index({
    org: 1,
    recipient: 1,
    type: 1,
    createdAt: -1
});


/**
 * Supports locating notifications linked to a resource.
 */
notificationSchema.index({
    org: 1,
    "resource.type": 1,
    "resource.id": 1
});


const Notification =
    models.Notification || model("Notification", notificationSchema);


export default Notification;