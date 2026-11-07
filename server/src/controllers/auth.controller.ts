import { Request, Response } from 'express';
import * as svc from '../services/auth.service';
import { ok, created } from '../utils/respond';

export const register = async (req: Request, res: Response) => created(res, await svc.register(req.body, req.ip));
export const verifySignupOtp = async (req: Request, res: Response) => ok(res, await svc.verifySignupOtp(req.body.email, req.body.otp, req.body.deviceName));
export const resendSignupOtp = async (req: Request, res: Response) => ok(res, await svc.resendSignupOtp(req.body.email));
export const login = async (req: Request, res: Response) => ok(res, await svc.login(req.body));
export const refresh = async (req: Request, res: Response) => ok(res, await svc.refresh(req.body.refreshToken));
export const logout = async (req: Request, res: Response) => {
  await svc.logout((req as any).user._id, req.body.refreshToken, req.body.pushToken);
  return ok(res, { message: 'Logged out' }, 'Logged out');
};
export const logoutAll = async (req: Request, res: Response) => {
  await svc.logoutAll((req as any).user._id);
  return ok(res, { message: 'Logged out from all devices' }, 'Logged out from all devices');
};
export const forgot = async (req: Request, res: Response) => {
  await svc.forgotPassword(req.body.email);
  return ok(res, { message: 'If an account exists, a code has been sent.' });
};
export const verifyOtp = async (req: Request, res: Response) => ok(res, { resetToken: await svc.verifyOtp(req.body.email, req.body.otp) });
export const reset = async (req: Request, res: Response) => {
  await svc.resetPassword(req.body.resetToken, req.body.newPassword);
  return ok(res, { message: 'Password updated. Please log in.' });
};
export const changePassword = async (req: Request, res: Response) => ok(res, await svc.changePassword((req as any).user._id, req.body.currentPassword, req.body.newPassword));
export const me = async (req: Request, res: Response) => ok(res, await svc.me((req as any).user._id));
