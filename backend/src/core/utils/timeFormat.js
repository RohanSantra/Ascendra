
/**
 * Formats a date and time using Indian Standard Time.
 *
 * @param {Date} date - Date to format.
 * @returns {string} Formatted date and time.
 */
export const formatTimestamp = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
    }).formatToParts(date);

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    return `${values.day} ${values.month} ${values.year}, ${values.hour}:${values.minute}:${values.second} ${values.dayPeriod} IST`;
};
