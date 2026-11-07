import { Router } from 'express';
import * as c from '../controllers/society.controller';
import { authenticate } from '../middleware/authenticate';
import { requireGlobalRole } from '../middleware/requireGlobalRole';
import { requireMember } from '../middleware/requireMember';
import { requireSocietyAdmin } from '../middleware/requireSocietyAdmin';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as v from '../validators/society.validator';
import { lookupLimiter } from '../middleware/rateLimiters';

const r = Router();
r.use(authenticate);
r.get('/mine', asyncHandler(c.mine));
r.get('/lookup', lookupLimiter, validate(v.lookupSchema), asyncHandler(c.lookup));
r.post('/join', validate(v.joinSchema), asyncHandler(c.join));
r.post('/', requireGlobalRole('admin'), validate(v.createSocietySchema), asyncHandler(c.createSociety));

r.get('/:societyId', requireMember, validate(v.societyIdParams), asyncHandler(c.getOne));
r.patch('/:societyId', requireMember, requireSocietyAdmin, validate(v.updateSocietySchema), asyncHandler(c.updateSociety));
r.patch('/:societyId/settings', requireMember, requireSocietyAdmin, validate(v.updateSettingsSchema), asyncHandler(c.updateSettings));
r.post('/:societyId/join-code/regenerate', requireMember, requireSocietyAdmin, validate(v.societyIdParams), asyncHandler(c.regenerate));

r.get('/:societyId/members', requireMember, requireSocietyAdmin, validate({ params: v.societyIdParams.params, query: v.membersListSchema.query }), asyncHandler(c.listMembers));
r.get('/:societyId/directory', requireMember, validate({ params: v.societyIdParams.params, query: v.directorySchema.query }), asyncHandler(c.directory));
r.patch('/:societyId/members/:membershipId/approve', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.approve));
r.patch('/:societyId/members/:membershipId/reject', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.reject));
r.patch('/:societyId/members/:membershipId/role', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.role));
r.patch('/:societyId/members/:membershipId/permissions', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.permissions));
r.patch('/:societyId/members/:membershipId/verify', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.verify));
r.patch('/:societyId/members/:membershipId/suspend', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.suspend));
r.delete('/:societyId/members/:membershipId', requireMember, requireSocietyAdmin, validate(v.membershipIdParams), asyncHandler(c.remove));
r.post('/:societyId/leave', requireMember, validate(v.societyIdParams), asyncHandler(c.leave));

export default r;
