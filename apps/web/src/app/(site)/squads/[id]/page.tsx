import type { Metadata } from 'next';
import type { LfgPost } from '@tgh/shared';
import { LfgPostView } from '@/features/squads/LfgPostView';
import { getT } from '@/i18n/server';
import { serverApiOr } from '@/lib/api/server';

export async function generateMetadata(props: PageProps<'/squads/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const [t, post] = await Promise.all([getT(), serverApiOr<LfgPost | null>(`/lfg/${id}`, null)]);
  return { title: post ? `${post.game.title} · ${post.mode}` : t.lfg.metaTitle };
}

export default async function SquadPostPage(props: PageProps<'/squads/[id]'>) {
  const { id } = await props.params;
  return (
    <div className="container page">
      <LfgPostView id={id} />
    </div>
  );
}
