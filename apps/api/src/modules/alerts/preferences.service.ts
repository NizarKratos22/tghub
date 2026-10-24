import {
  ALERT_CATEGORIES,
  type AlertCategory,
  type AlertPreferences as AlertPreferencesDto,
  type AlertPreferencesUpdate,
} from '@tgh/shared';
import { isDuplicateKeyError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { Game } from '../games/game.model';
import { AlertPreference, type AlertPreferenceDoc } from './alerts.model';

/**
 * Low-noise defaults: every category is on, but game updates only arrive for
 * games the player follows (favouriting a game follows it).
 */
const DEFAULT_CATEGORIES = Object.fromEntries(ALERT_CATEGORIES.map((c) => [c, true])) as Record<AlertCategory, boolean>;

function toDto(doc: AlertPreferenceDoc): AlertPreferencesDto {
  return {
    categories: { ...DEFAULT_CATEGORIES, ...doc.categories },
    followedGameIds: doc.followedGameIds.map(String),
    followAllGames: doc.followAllGames,
    maxPerDay: doc.maxPerDay,
  };
}

export async function ensurePreferences(userId: string): Promise<void> {
  const upsert = () =>
    AlertPreference.updateOne(
      { userId },
      {
        $setOnInsert: {
          userId: toObjectId(userId),
          categories: DEFAULT_CATEGORIES,
          followedGameIds: [],
          followAllGames: false,
          maxPerDay: 15,
        },
      },
      { upsert: true },
    );
  try {
    await upsert();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
}

export async function getPreferences(userId: string): Promise<AlertPreferencesDto> {
  await ensurePreferences(userId);
  const doc = await AlertPreference.findOne({ userId }).lean<AlertPreferenceDoc>();
  return toDto(doc!);
}

export async function updatePreferences(userId: string, input: AlertPreferencesUpdate): Promise<AlertPreferencesDto> {
  await ensurePreferences(userId);
  const set: Record<string, unknown> = {};

  for (const [category, enabled] of Object.entries(input.categories ?? {})) {
    set[`categories.${category}`] = enabled;
  }
  if (input.followedGameIds) {
    // Silently drop ids that aren't real games rather than storing junk.
    const games = await Game.find({ _id: { $in: input.followedGameIds } }).select('_id').lean();
    set.followedGameIds = games.map((g) => g._id);
  }
  if (input.followAllGames !== undefined) set.followAllGames = input.followAllGames;
  if (input.maxPerDay !== undefined) set.maxPerDay = input.maxPerDay;

  const doc = await AlertPreference.findOneAndUpdate({ userId }, { $set: set }, { returnDocument: 'after' }).lean<AlertPreferenceDoc>();
  return toDto(doc!);
}

export async function followGame(userId: string, gameId: string): Promise<void> {
  await ensurePreferences(userId);
  await AlertPreference.updateOne({ userId }, { $addToSet: { followedGameIds: toObjectId(gameId) } });
}
