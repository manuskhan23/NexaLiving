import { Router } from 'express';
import * as c from '../controllers/announcement.controller';
import { authenticate } from '../middleware/authenticate';
import { requireMember } from '../middleware/requireMember';
import { requireSocietyAdmin } from '../middleware/requireSocietyAdmin';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as v from '../validators/announcement.validator';

const r = Router({ mergeParams: true });
r.use(authenticate, requireMember);
r.get('/', validate(v.listSchema), asyncHandler(c.list));
r.get('/:announcementId', validate(v.itemParams), asyncHandler(c.getOne));
r.post('/', requireSocietyAdmin, validate(v.createSchema), asyncHandler(c.create));
r.patch('/:announcementId', requireSocietyAdmin, validate(v.itemParams), asyncHandler(c.update));
r.patch('/:announcementId/pin', requireSocietyAdmin, validate(v.pinSchema), asyncHandler(c.pin));
r.delete('/:announcementId', requireSocietyAdmin, validate(v.itemParams), asyncHandler(c.remove));
export default r;
