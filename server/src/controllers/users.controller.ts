import { Request, Response } from 'express';
import * as svc from '../services/user.service';
import { ok } from '../utils/respond';
export const updateProfile = async (req: Request, res: Response) => ok(res, { user: await svc.updateProfile((req as any).user._id, req.body) });
export const updateSettings = async (req: Request, res: Response) => ok(res, { settings: await svc.updateSettings((req as any).user._id, req.body) });
export const setAvatar = async (req: Request, res: Response) => {
  if (!(req as any).file) throw Object.assign(new Error('Missing file'), { statusCode: 400, code: 'VALIDATION_ERROR' });
  ok(res, { avatar: await svc.setAvatar((req as any).user._id, (req as any).file.buffer) });
};
export const becomeAdmin = async (req: Request, res: Response) => ok(res, { user: await svc.becomeAdmin((req as any).user._id, req.body.adminCode) });
export const removeAvatar = async (req: Request, res: Response) => { await svc.removeAvatar((req as any).user._id); return ok(res, { message: 'Avatar removed' }); };
export const addPushToken = async (req: Request, res: Response) => { await svc.addPushToken((req as any).user._id, req.body.token, req.body.platform); return ok(res, { message: 'Push token saved' }); };
export const removePushToken = async (req: Request, res: Response) => { await svc.removePushToken((req as any).user._id, decodeURIComponent(req.params.token)); return ok(res, { message: 'Removed' }); };
export const getProfile = async (req: Request, res: Response) => ok(res, { profile: await svc.getProfile(req.params.userId, (req as any).user._id, String(req.query.societyId)) });
export const deleteAccount = async (req: Request, res: Response) => { await svc.deleteAccount((req as any).user._id, req.body.password); return ok(res, { message: 'Account deleted' }); };
