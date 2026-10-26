import type { AdminGuideRow, GuideDetail, GuideInput, GuideSummary } from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { Game, type GameDoc } from '../games/game.model';
import { GAME_SUMMARY_FIELDS, toGameDetail, toGameRef, toGameSummary } from '../games/games.mapper';
import { findGameBySlug } from '../games/games.service';
import { Guide, type GuideDoc } from './guide.model';

/** Published guides, most popular games first. */
export async function listGuides(): Promise<GuideSummary[]> {
  const guides = await Guide.find({ published: true }).lean<GuideDoc[]>();
  const games = await Game.find({ _id: { $in: guides.map((guide) => guide.gameId) }, status: 'published' })
    .select(GAME_SUMMARY_FIELDS)
    .sort({ popularity: -1 })
    .lean<GameDoc[]>();
  const byGame = new Map(guides.map((guide) => [String(guide.gameId), guide]));
  return games.map((game) => {
    const guide = byGame.get(String(game._id))!;
    return {
      game: toGameSummary(game),
      intro: guide.intro,
      sectionTitles: guide.sections.map((section) => section.title),
      appCount: guide.overwolfApps.length,
      updatedAt: guide.updatedAt.toISOString(),
    };
  });
}

export async function getGuide(slug: string): Promise<GuideDetail> {
  const game = await findGameBySlug(slug);
  const guide = await Guide.findOne({ gameId: game._id, published: true }).lean<GuideDoc>();
  if (!guide) throw AppError.notFound('Guide');
  return {
    game: toGameDetail(game),
    intro: guide.intro,
    sections: guide.sections,
    overwolfApps: guide.overwolfApps,
    overwolfStoreUrl: guide.overwolfStoreUrl,
    updatedAt: guide.updatedAt.toISOString(),
  };
}

/* ───────────── Admin ───────────── */

export async function adminListGuides(): Promise<AdminGuideRow[]> {
  const [games, guides] = await Promise.all([
    Game.find({ status: 'published' }).select('_id slug title monogram accent').sort({ titleLower: 1 }).lean<GameDoc[]>(),
    Guide.find().lean<GuideDoc[]>(),
  ]);
  const byGame = new Map(guides.map((guide) => [String(guide.gameId), guide]));
  return games.map((game) => {
    const guide = byGame.get(String(game._id));
    return {
      game: toGameRef(game),
      guide: guide
        ? {
            published: guide.published,
            intro: guide.intro,
            sections: guide.sections,
            overwolfApps: guide.overwolfApps,
            overwolfStoreUrl: guide.overwolfStoreUrl,
            updatedAt: guide.updatedAt.toISOString(),
          }
        : null,
    };
  });
}

export async function adminSaveGuide(gameId: string, input: GuideInput, adminId: string): Promise<void> {
  if (!(await Game.exists({ _id: toObjectId(gameId) }))) throw AppError.notFound('Game');
  await Guide.updateOne({ gameId: toObjectId(gameId) }, { $set: { ...input, updatedBy: toObjectId(adminId) } }, { upsert: true });
}

export async function adminDeleteGuide(gameId: string): Promise<void> {
  const result = await Guide.deleteOne({ gameId: toObjectId(gameId) });
  if (result.deletedCount === 0) throw AppError.notFound('Guide');
}
