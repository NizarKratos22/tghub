import { Router } from 'express';
import { changeEmailSchema, changePasswordSchema, equipTitleSchema, idParamsSchema, updateProfileSchema, usernameSchema, verifyEmailSchema } from '@tgh/shared';
import { z } from 'zod';
import { requireAuth, requireVerifiedEmail } from '../../core/auth/middleware';
import { AppError } from '../../core/http/errors';
import { handle } from '../../core/http/handler';
import { uploadLimiter, verificationLimiter } from '../../core/http/rate-limit';
import { changePassword, confirmEmailChange, listSessions, requestEmailChange, revokeOtherSessions, revokeSession } from '../auth/account.service';
import { singleFile } from '../media/media.routes';
import { clearProfileImage, equipTitle, getMe, getPublicProfile, setProfileImage, updateProfile } from './users.service';

export const meRouter = Router();
meRouter.use(requireAuth);

meRouter.get('/', handle({}, ({ user }) => getMe(user().userId)));

meRouter.patch(
  '/',
  handle({ body: updateProfileSchema }, ({ body, user }) => updateProfile(user().userId, body)),
);

meRouter.put(
  '/title',
  handle({ body: equipTitleSchema }, ({ body, user }) => equipTitle(user().userId, body.title)),
);

/* Profile pictures: multipart "file", processed like listing photos (EXIF stripped, WebP). */

for (const kind of ['avatar', 'banner'] as const) {
  meRouter.post(
    `/${kind}`,
    requireVerifiedEmail,
    uploadLimiter,
    singleFile,
    handle({}, ({ req, user }) => {
      if (!req.file) throw AppError.unprocessable('Choose an image to upload', { fields: { file: 'Choose an image to upload' } });
      return setProfileImage(user().userId, kind, req.file.buffer);
    }),
  );
  meRouter.delete(`/${kind}`, handle({}, ({ user }) => clearProfileImage(user().userId, kind)));
}

/* Account security */

meRouter.put(
  '/password',
  verificationLimiter,
  handle({ body: changePasswordSchema }, async ({ body, user }) => {
    const { userId, sessionId } = user();
    await changePassword(userId, sessionId, body.currentPassword, body.newPassword);
  }),
);

meRouter.post('/email', verificationLimiter, handle({ body: changeEmailSchema }, ({ body, user }) => requestEmailChange(user().userId, body.email, body.password)));

meRouter.post(
  '/email/confirm',
  verificationLimiter,
  handle({ body: verifyEmailSchema }, async ({ body, user }) => {
    await confirmEmailChange(user().userId, body.code);
    return getMe(user().userId);
  }),
);

meRouter.get('/sessions', handle({}, ({ user }) => listSessions(user().userId, user().sessionId)));
meRouter.post('/sessions/revoke-others', handle({}, ({ user }) => revokeOtherSessions(user().userId, user().sessionId)));
meRouter.delete(
  '/sessions/:id',
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await revokeSession(user().userId, params.id);
  }),
);

export const usersRouter = Router();

usersRouter.get(
  '/:username',
  handle({ params: z.object({ username: usernameSchema }) }, ({ params }) => getPublicProfile(params.username)),
);
