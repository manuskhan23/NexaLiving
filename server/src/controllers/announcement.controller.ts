import { Request, Response } from 'express';
import * as svc from '../services/announcement.service';
import { ok, created } from '../utils/respond';
export const list = async (req: Request, res: Response) => {
  const isAdmin = (req as any).membership.role === 'admin';
  const { items, meta } = await svc.list(req.params.societyId, req.query as any, (req as any).user._id, isAdmin);
  return ok(res, { items }, undefined, meta);
};
export const getOne = async (req: Request, res: Response) => ok(res, { announcement: await svc.getOne(req.params.societyId, req.params.announcementId, (req as any).user._id) });
export const create = async (req: Request, res: Response) => created(res, { announcement: await svc.create(req.params.societyId, req.body, (req as any).user._id) });
export const update = async (req: Request, res: Response) => ok(res, { announcement: await svc.update(req.params.societyId, req.params.announcementId, req.body, (req as any).user._id) });
export const pin = async (req: Request, res: Response) => ok(res, { announcement: await svc.pin(req.params.societyId, req.params.announcementId, req.body.isPinned, (req as any).user._id) });
export const remove = async (req: Request, res: Response) => { await svc.remove(req.params.societyId, req.params.announcementId, (req as any).user._id); return ok(res, { message: 'Deleted' }); };
