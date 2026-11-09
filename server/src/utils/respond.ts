import { Response } from 'express';
export function ok(res: Response, data: any, message?: string, meta?: any) {
  const body: any = { success: true, data };
  if (message) body.message = message;
  if (meta) body.meta = meta;
  return res.status(200).json(body);
}
export function created(res: Response, data: any, message?: string) {
  const body: any = { success: true, data };
  if (message) body.message = message;
  return res.status(201).json(body);
}
export function noContent(res: Response) { return res.status(204).end(); }