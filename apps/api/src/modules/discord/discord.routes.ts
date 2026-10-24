import { Router, type RequestHandler } from 'express';
import { env } from '../../config/env';
import { logger } from '../../core/logger';
import { handleCommand, type Interaction, type InteractionResponse } from './commands';
import { verifyDiscordSignature } from './signature';

const PING = 1;
const APPLICATION_COMMAND = 2;

/** Discord's HTTP interactions endpoint. Unsigned or badly signed requests get a 401, as Discord requires. */
export const interactionsHandler =
  (publicKey: string | undefined = env.DISCORD_PUBLIC_KEY): RequestHandler =>
  async (req, res) => {
    if (!publicKey) {
      res.status(503).json({ error: { code: 'BOT_DISABLED', message: 'The Discord bot is not configured' } });
      return;
    }
    const valid = verifyDiscordSignature(publicKey, req.get('x-signature-ed25519'), req.get('x-signature-timestamp'), req.rawBody);
    if (!valid) {
      res.status(401).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid request signature' } });
      return;
    }

    const interaction = req.body as Interaction;
    let response: InteractionResponse;
    if (interaction.type === PING) {
      response = { type: 1 };
    } else if (interaction.type === APPLICATION_COMMAND) {
      try {
        response = await handleCommand(interaction);
      } catch (error) {
        logger.error({ err: error }, 'Discord command failed');
        response = { type: 4, data: { content: 'Something went wrong on TG Hub — try again in a moment.', flags: 64 } };
      }
    } else {
      response = { type: 4, data: { content: 'Not supported yet.', flags: 64 } };
    }
    res.json(response);
  };

/** Mounted at /api/v1/discord. */
export const discordRouter = Router();
discordRouter.post('/interactions', interactionsHandler());
