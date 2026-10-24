import type { Metadata } from 'next';
import type { LfgPost } from '@tgh/shared';
import { LfgPostView } from '@/features/squads/LfgPostView';
import { serverApiOr } from '@/lib/api/server';

export async function generateMetadata(props: PageProps<'/squads/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const post = await serverApiOr<LfgPost | null>(`/lfg/${id}`, null);
  return { title: post ? `${post.game.title} · ${post.mode}` : 'Squad post' };
}

export default async function SquadPostPage(props: PageProps<'/squads/[id]'>) {
  const { id } = await props.params;
  return (
    <div className="container page">
      <LfgPostView id={id} />
    </div>
  );
}
