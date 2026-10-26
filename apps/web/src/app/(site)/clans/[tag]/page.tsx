import type { Metadata } from 'next';
import type { ClanDetail } from '@tgh/shared';
import { ClanView } from '@/features/squads/ClanView';
import { fill } from '@/i18n/config';
import { getLocale, getT } from '@/i18n/server';
import { serverApiOr } from '@/lib/api/server';

export async function generateMetadata(props: PageProps<'/clans/[tag]'>): Promise<Metadata> {
  const { tag } = await props.params;
  const [t, locale, clan] = await Promise.all([getT(), getLocale(), serverApiOr<ClanDetail | null>(`/clans/${encodeURIComponent(tag.toUpperCase())}`, null)]);
  return clan
    ? { title: `[${clan.tag}] ${clan.name}`, description: clan.description || fill(t.clan.membersOnHub, { count: clan.memberCount }, locale) }
    : { title: t.clan.notFound };
}

export default async function ClanPage(props: PageProps<'/clans/[tag]'>) {
  const { tag } = await props.params;
  return <ClanView tag={decodeURIComponent(tag).toUpperCase()} />;
}
