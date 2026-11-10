
import { z } from "zod";

/**
 * Validates course date values.
 *
 * Accepts YYYY-MM-DD and ISO 8601 date-time strings.
 */
const courseDateSchema = z.string().refine(
    (value) => {
        const datePattern =
            /^\d{4}-\d{2}-\d{2}$/;

        const dateTimePattern =
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

        if (
            !datePattern.test(value) &&
            !dateTimePattern.test(value)
        ) {
            return false;
        }

        const parsedDate = new Date(value);

        if (Number.isNaN(parsedDate.getTime())) {
            return false;
        }

        // Reject impossible calendar dates.
        if (datePattern.test(value)) {
            return parsedDate.toISOString().slice(0, 10) === value;
        }

        return true;
    },
    {
        message: "Provide a valid date or ISO 8601 date-time."
    }
);

/**
 * Validates course date ranges.
 */
const courseDateRangeSchema = {
    startDate: courseDateSchema,
    endDate: courseDateSchema
};

/**
 * @name createCourseSchema
 * @description Validates data required to create a course
 * from an existing trainer assignment.
 *
 * Trainer, trainer profile, requirement and organisation
 * references are resolved by the service.
 */
export const createCourseSchema = z.object({
    body: z.object({
        trainerAssignmentId: z.string().regex(
            /^[a-f\d]{24}$/i,
            "Invalid trainer assignment ID."
        ),

        title: z.string()
            .trim()
            .min(3, "Course title must contain at least 3 characters.")
            .max(200, "Course title cannot exceed 200 characters."),

        description: z.string()
            .trim()
            .max(3000, "Course description cannot exceed 3000 characters.")
            .optional(),

        ...courseDateRangeSchema
    }).strict().refine(
        (data) =>
            new Date(data.endDate) >= new Date(data.startDate),
        {
            message: "Course end date cannot be earlier than its start date.",
            path: ["endDate"]
        }
    )
});

/**
 * @name updateCourseSchema
 * @description Validates permitted course information updates.
 *
 * Assignment references, ownership and course status cannot
 * be changed through this general update endpoint.
 */
export const updateCourseSchema = z.object({
    params: z.object({
        id: z.string().regex(
            /^[a-f\d]{24}$/i,
            "Invalid course ID."
        )
    }),

    body: z.object({
        title: z.string()
            .trim()
            .min(3, "Course title must contain at least 3 characters.")
            .max(200, "Course title cannot exceed 200 characters.")
            .optional(),

        description: z.string()
            .trim()
            .max(3000, "Course description cannot exceed 3000 characters.")
            .optional(),

        startDate: courseDateSchema.optional(),

        endDate: courseDateSchema.optional()
    }).strict().refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "At least one course field must be provided."
        }
    )
});

/**
 * @name courseIdParamsSchema
 * @description Validates course ID route parameters.
 */
export const courseIdParamsSchema = z.object({
    params: z.object({
        id: z.string().regex(
            /^[a-f\d]{24}$/i,
            "Invalid course ID."
        )
    })
});

/**
 * @name listCoursesQuerySchema
 * @description Validates course listing filters and pagination.
 */
export const listCoursesQuerySchema = z.object({
    query: z.object({
        status: z.enum([
            "draft",
            "published",
            "ongoing",
            "completed",
            "cancelled",
            "archived"
        ]).optional(),

        page: z.coerce.number()
            .int()
            .min(1)
            .default(1),

        limit: z.coerce.number()
            .int()
            .min(1)
            .max(100)
            .default(10),

        sortBy: z.enum([
            "createdAt",
            "updatedAt",
            "startDate",
            "endDate",
            "title"
        ]).default("createdAt"),

        sortOrder: z.enum([
            "asc",
            "desc"
        ]).default("desc")
    }).strict()
});

/**
 * @name updateCourseStatusSchema
 * @description Validates course lifecycle status transitions.
 */
export const updateCourseStatusSchema = z.object({
    body: z.object({
        status: z.enum([
            "published",
            "ongoing",
            "completed",
            "cancelled",
            "archived"
        ])
    }).strict()
});