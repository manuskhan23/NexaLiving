import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { ApiError } from '../utils/ApiError';

const LABELS: Record<string, string> = {
  cnic: 'CNIC', otp: 'Code', url: 'Image', publicId: 'Image', feeMin: 'Minimum fee', feeMax: 'Maximum fee',
  joinCode: 'Join code', adminCode: 'Admin code', unitLabel: 'House / unit number', startAt: 'Start time', endAt: 'End time',
  neededFrom: 'Needed from', neededTo: 'Needed until', fromLabel: 'Starting point', toLabel: 'Destination',
};

// "monthlyRent" -> "Monthly rent"; uses the last named segment of the path ("images.0.url" -> "Image").
function label(path: (string | number)[]): string {
  const key = [...path].reverse().find((p) => typeof p === 'string') as string | undefined;
  if (!key) return 'This field';
  if (LABELS[key]) return LABELS[key];
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Turns zod's developer wording ("String must contain at least 5 character(s)") into a sentence
// that names the field. Custom messages written in the schemas are kept as they are.
export function friendlyIssue(i: ZodIssue): string {
  const f = label(i.path);
  const n = (v: any) => Number(v).toLocaleString('en-US');
  switch (i.code) {
    case 'invalid_type':
      return i.received === 'undefined' || i.received === 'null' ? `${f} is required.` : `${f} is not valid.`;
    case 'too_small':
      if (i.type === 'string') return Number(i.minimum) <= 1 ? `${f} is required.` : `${f} must be at least ${n(i.minimum)} characters.`;
      if (i.type === 'array') return Number(i.minimum) <= 1 ? `Choose at least one ${f.toLowerCase()}.` : `Choose at least ${n(i.minimum)} ${f.toLowerCase()}.`;
      if (i.type === 'number') return `${f} must be at least ${n(i.minimum)}.`;
      return `${f} is too short.`;
    case 'too_big':
      if (i.type === 'string') return `${f} must be at most ${n(i.maximum)} characters.`;
      if (i.type === 'array') return `${f}: you can add at most ${n(i.maximum)}.`;
      if (i.type === 'number') return `${f} must be at most ${n(i.maximum)}.`;
      return `${f} is too long.`;
    case 'invalid_enum_value':
      return `${f}: please choose one of the listed options.`;
    case 'invalid_string':
      if (i.validation === 'email') return 'Enter a valid email address.';
      return i.message && i.message !== 'Invalid' ? i.message : `${f} is not valid.`;
    case 'invalid_date':
      return `${f} must be a valid date.`;
    case 'not_multiple_of':
    case 'invalid_literal':
    case 'invalid_union':
      return `${f} is not valid.`;
    default:
      return i.message;
  }
}

export function validate(s: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (s.params) req.params = s.params.parse(req.params) as any;
      if (s.query) { const parsed = s.query.parse(req.query); Object.assign(req.query, parsed); }
      if (s.body) req.body = s.body.parse(req.body);
      next();
    } catch (e) {
      if (e instanceof ZodError) {
        const details = e.errors.map((i) => ({ path: i.path.join('.'), message: friendlyIssue(i) }));
        // one message per field is enough for a form
        const seen = new Set<string>();
        const unique = details.filter((d) => (seen.has(d.path) ? false : (seen.add(d.path), true)));
        return next(new ApiError(400, 'VALIDATION_ERROR', unique[0]?.message || 'Please check the form and try again.', unique));
      }
      next(e);
    }
  };
}
