import mongoose from "mongoose";

const { Schema, model, models } = mongoose;


/**
 * Stores announcements published within an organisation.
 *
 * Announcements are organisation-scoped and can target all
 * members, trainers or trainees.
 *
 * The initial implementation supports creating, publishing,
 * editing and archiving announcements.
 *
 * @name Announcement
 */
const announcementSchema = new Schema(
    {
        /**
         * Organisation that owns the announcement.
         */
        org: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            immutable: true
        },

        /**
         * Announcement title.
         */
        title: {
            type: String,
            required: true,
            trim: true,
            minlength: 3,
            maxlength: 200
        },

        /**
         * Main announcement message.
         */
        message: {
            type: String,
            required: true,
            trim: true,
            minlength: 1,
            maxlength: 5000
        },

        /**
         * Intended audience for the announcement.
         */
        audience: {
            type: String,
            enum: [
                "everyone",
                "trainers",
                "trainees"
            ],
            default: "everyone",
            required: true
        },

        /**
         * Announcement lifecycle status.
         */
        status: {
            type: String,
            enum: [
                "draft",
                "published",
                "archived"
            ],
            default: "draft",
            required: true
        },

        /**
         * Date when the announcement was published.
         */
        publishedAt: {
            type: Date,
            default: null
        },

        /**
         * Optional expiry date.
         *
         * This field allows future automatic expiry without
         * requiring a schema redesign.
         */
        expiresAt: {
            type: Date,
            default: null
        },

        /**
         * User who created the announcement.
         */
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true
        },

        /**
         * User who last updated the announcement.
         */
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);


/**
 * Supports organisation announcement listings.
 */
announcementSchema.index({
    org: 1,
    status: 1,
    createdAt: -1
});


/**
 * Supports retrieving published announcements for an audience.
 */
announcementSchema.index({
    org: 1,
    status: 1,
    audience: 1,
    publishedAt: -1
});


/**
 * Supports finding announcements approaching or passing expiry.
 */
announcementSchema.index({
    org: 1,
    status: 1,
    expiresAt: 1
});


const Announcement =
    models.Announcement || model("Announcement", announcementSchema);


export default Announcement;