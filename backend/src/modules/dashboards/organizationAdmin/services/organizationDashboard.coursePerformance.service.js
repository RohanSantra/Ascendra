import {
    getCoursePerformanceSummary
} from "../repositories/organizationDashboard.coursePerformance.repository.js";

import {
    HTTP_STATUS,
    ERROR_CODES
} from "../../../../core/constants/index.js";

import AppError from "../../../../core/errors/AppError.js";


/**
 * Creates the UTC date range for a monthly reporting period.
 *
 * @param {number} periodMonths - Number of months to include.
 * @returns {{startDate: Date, endDate: Date}} Reporting date range.
 */
const getReportingDateRange = (periodMonths) => {
    const now = new Date();

    const endDate = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            1
        )
    );

    const startDate = new Date(
        Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth() - periodMonths,
            1
        )
    );

    return {
        startDate,
        endDate
    };
};


/**
 * Retrieves course and enrolment performance for an organisation.
 *
 * @param {Object} options - Reporting options.
 * @param {string} options.orgId - Current organisation ID.
 * @param {number} [options.periodMonths=12] - Reporting period.
 * @returns {Promise<Object>} Course performance report.
 * @throws {AppError} If reporting options are invalid.
 */
export const getCoursePerformanceReport = async ({
    orgId,
    periodMonths = 12
}) => {
    if (!orgId) {
        throw new AppError(
            "Organisation context is required.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    if (
        !Number.isInteger(periodMonths) ||
        periodMonths < 1 ||
        periodMonths > 24
    ) {
        throw new AppError(
            "Reporting period must be between 1 and 24 months.",
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
        );
    }

    const { startDate, endDate } =
        getReportingDateRange(periodMonths);

    let courses;

    try {
        courses = await getCoursePerformanceSummary({
            orgId,
            startDate,
            endDate
        });
    } catch (error) {
        if (
            error?.message === "A valid organisation ID is required." ||
            error?.message === "A valid reporting date range is required."
        ) {
            throw new AppError(
                "A valid organisation reporting context is required.",
                HTTP_STATUS.BAD_REQUEST,
                ERROR_CODES.VALIDATION_ERROR
            );
        }

        throw error;
    }

    const overview = courses.reduce(
        (summary, course) => {
            summary.totalCourses += 1;
            summary.totalEnrollments += course.totalEnrollments;
            summary.activeEnrollments +=
                course.enrolled + course.inProgress;
            summary.completedEnrollments += course.completed;
            summary.withdrawnEnrollments += course.withdrawn;
            summary.cancelledEnrollments += course.cancelled;
            summary.eligibleEnrollments += course.eligibleEnrollments;

            return summary;
        },
        {
            totalCourses: 0,
            totalEnrollments: 0,
            activeEnrollments: 0,
            completedEnrollments: 0,
            withdrawnEnrollments: 0,
            cancelledEnrollments: 0,
            eligibleEnrollments: 0
        }
    );

    overview.completionRate =
        overview.eligibleEnrollments > 0
            ? Number(
                (
                    overview.completedEnrollments /
                    overview.eligibleEnrollments *
                    100
                ).toFixed(2)
            )
            : 0;

    return {
        generatedAt: new Date(),

        period: {
            months: periodMonths,
            startDate,
            endDate
        },

        overview,
        courses
    };
};