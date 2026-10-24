import type { Metadata } from 'next';
import type { ClanDetail } from '@tgh/shared';
import { ClanView } from '@/features/squads/ClanView';
import { serverApiOr } from '@/lib/api/server';

export async function generateMetadata(props: PageProps<'/clans/[tag]'>): Promise<Metadata> {
  const { tag } = await props.params;
  const clan = await serverApiOr<ClanDetail | null>(`/clans/${encodeURIComponent(tag.toUpperCase())}`, null);
  return clan ? { title: `[${clan.tag}] ${clan.name}`, description: clan.description || `${clan.memberCount} members on TG Hub.` } : { title: 'Clan not found' };
}

export default async function ClanPage(props: PageProps<'/clans/[tag]'>) {
  const { tag } = await props.params;
  return <ClanView tag={decodeURIComponent(tag).toUpperCase()} />;
}
