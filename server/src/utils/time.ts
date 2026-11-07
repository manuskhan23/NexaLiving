import * as dayjs from 'dayjs';
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
export { dayjs };
export function localToUtc(dateStr: string, timeStr: string, tz: string): Date {
  return (dayjs as any).tz(dateStr + ' ' + timeStr, 'YYYY-MM-DD HH:mm', tz).toDate();
}
export function toIsoUtc(d: Date): string { return d.toISOString(); }