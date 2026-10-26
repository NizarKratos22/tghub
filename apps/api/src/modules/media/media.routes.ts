import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { mediaParamsSchema } from '@tgh/shared';
import { z } from 'zod';
import { env } from '../../config/env';
import { requireAuth, requireVerifiedEmail } from '../../core/auth/middleware';
import { AppError } from '../../core/http/errors';
import { handle } from '../../core/http/handler';
import { uploadLimiter } from '../../core/http/rate-limit';
import { publicObjectUrl, storage } from '../../core/storage/storage';
import { storeImage } from './media.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MEDIA_MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 4 },
}).single('file');

/** Multer reports limits as its own error type; turn them into the API's error shape. */
export const singleFile: RequestHandler = (req, res, next) => {
  upload(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? `Images can be up to ${env.MEDIA_MAX_UPLOAD_MB} MB` : 'Send one image in the "file" field';
      return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, 'UPLOAD_REJECTED', message, { fields: { file: message } }));
    }
    next(error);
  });
};

/** Mounted at /api/v1/media behind auth + CSRF. */
export const mediaRouter = Router();

mediaRouter.post(
  '/',
  requireAuth,
  requireVerifiedEmail,
  uploadLimiter,
  singleFile,
  handle({ body: z.object({ purpose: z.literal('listing').default('listing') }), status: 201 }, ({ req, body, user }) => {
    if (!req.file) throw AppError.unprocessable('Choose an image to upload', { fields: { file: 'Choose an image to upload' } });
    return storeImage(user().userId, body.purpose, req.file.buffer);
  }),
);

/**
 * Public file delivery. Registered ahead of the API rate limiter — a listing
 * grid loads dozens of thumbnails — and cached forever because ids never repeat.
 * With an R2 public domain, old /api/v1/media links (saved in feed items, say)
 * are sent there instead of streaming through this server.
 */
export const serveMediaFile: RequestHandler = async (req, res) => {
  const parsed = mediaParamsSchema.safeParse(req.params);
  if (!parsed.success) throw AppError.notFound('File');
  const publicUrl = publicObjectUrl(parsed.data.file);
  if (publicUrl) {
    res.set('Cache-Control', 'public, max-age=86400');
    return res.redirect(302, publicUrl);
  }
  const file = await storage.open(parsed.data.file);
  if (!file) throw AppError.notFound('File');
  res.set({
    'Content-Type': 'image/webp',
    'Content-Length': String(file.size),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Security-Policy': "default-src 'none'",
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  file.stream.on('error', () => res.destroy());
  file.stream.pipe(res);
};
