export const formatRuntime = (totalMinutes: number): string => {
    if (!totalMinutes || totalMinutes === 0) return "0 h";

    const minutesInHour = 60;
    const minutesInDay = minutesInHour * 24;
    const minutesInMonth = minutesInDay * 30;
    const minutesInYear = minutesInDay * 365;

    let remaining = totalMinutes;

    const years = Math.floor(remaining / minutesInYear);
    remaining %= minutesInYear;

    const months = Math.floor(remaining / minutesInMonth);
    remaining %= minutesInMonth;

    const days = Math.floor(remaining / minutesInDay);
    remaining %= minutesInDay;

    const hours = Math.floor(remaining / minutesInHour);

    const parts = [];
    if (years > 0) parts.push(`${years}a`);
    if (months > 0) parts.push(`${months}m`);
    if (days > 0) parts.push(`${days}j`);
    if (hours > 0) parts.push(`${hours}h`);

    return parts.join(' ') || '< 1 h';
};