/**
 * Utility functions for timezone-consistent date handling (Asia/Karachi, UTC+5).
 * Prevents off-by-one date shifts around midnight UTC.
 */

const TIMEZONE = 'Asia/Karachi';

/**
 * Returns today's date in Karachi formatted as YYYY-MM-DD.
 * If a Date object is provided, returns that date formatted in Asia/Karachi timezone.
 */
export function getTodayKarachi(dateObj: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(dateObj); // returns 'YYYY-MM-DD'
}

/**
 * Returns the current year in Karachi timezone as a number.
 */
export function getCurrentKarachiYear(dateObj: Date = new Date()): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric'
    });
    return parseInt(formatter.format(dateObj), 10);
}

/**
 * Returns current month details in Karachi timezone.
 * month: "January", "February", etc.
 * year: 2026
 * monthIndex: 0-11
 * monthCode: "YYYY-MM"
 */
export function getCurrentKarachiMonthDetails(dateObj: Date = new Date()): {
    month: string;
    year: number;
    monthIndex: number;
    monthCode: string;
} {
    const todayStr = getTodayKarachi(dateObj); // "YYYY-MM-DD"
    const [yearStr, monthNumStr] = todayStr.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1;

    const monthNameFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        month: 'long'
    });
    const month = monthNameFormatter.format(dateObj);

    return {
        month,
        year,
        monthIndex,
        monthCode: `${yearStr}-${monthNumStr}`
    };
}

/**
 * Returns a date string (YYYY-MM-DD) offset by days from today in Karachi timezone.
 */
export function getKarachiDateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return getTodayKarachi(d);
}

/**
 * Returns the first day of the current month in Karachi (YYYY-MM-01).
 */
export function getFirstDayOfKarachiMonth(dateObj: Date = new Date()): string {
    const todayStr = getTodayKarachi(dateObj);
    const [year, month] = todayStr.split('-');
    return `${year}-${month}-01`;
}
