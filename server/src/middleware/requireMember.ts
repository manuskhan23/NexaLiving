import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { Society } from '../models/Society';
import { Membership } from '../models/Membership';
export async function requireMember(req: Request, _res: Response, next: NextFunction) {
  try {
    const sid = req.params.societyId;
    if (!sid || !mongoose.isValidObjectId(sid)) return next(ApiError.notFound());
    const society = await Society.findOne({ _id: sid, isActive: true }).lean() as any;
    if (!society) return next(ApiError.notFound('Society not found'));
    const uid = (req as any).user?._id;
    const membership = await Membership.findOne({ user: uid, society: sid }).lean() as any;
    if (!membership) return next(ApiError.forbidden('NOT_MEMBER', 'You are not a member of this society'));
    if (membership.status === 'pending') return next(ApiError.forbidden('MEMBERSHIP_PENDING', 'Your membership is pending approval'));
    if (membership.status === 'suspended') return next(ApiError.forbidden('MEMBERSHIP_SUSPENDED', 'Your membership is suspended'));
    if (membership.status !== 'active') return next(ApiError.forbidden('NOT_MEMBER', 'Inactive membership'));
    (req as any).society = society;
    (req as any).membership = membership;
    next();
  } catch (err) { next(err); }
}