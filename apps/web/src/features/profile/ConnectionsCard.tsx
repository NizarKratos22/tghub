'use client';

import type { Connections } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { DiscordLogo, discordStartUrl, oauthErrorMessage, steamStartUrl } from '@/features/auth/oauth';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import shared from './SecuritySettings.module.css';
import styles from './ConnectionsCard.module.css';

const CONNECTIONS_KEY = ['me', 'connections'] as const;

/** Reads ?connected= / ?auth_error= left by the OAuth redirect once, then tidies the URL. */
function useFlash(): { kind: 'ok' | 'error'; text: string } | null {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [flash] = useState(() => {
    const connected = params.get('connected');
    if (connected) return { kind: 'ok' as const, text: fill(t.security.connected, { provider: connected === 'steam' ? 'Steam' : 'Discord' }) };
    const error = oauthErrorMessage(params.get('auth_error'), t);
    return error ? { kind: 'error' as const, text: error } : null;
  });
  const tidyUrl = useEffectEvent(() => {
    if (params.has('connected') || params.has('auth_error')) router.replace(pathname, { scroll: false });
  });
  useEffect(() => tidyUrl(), []);
  return flash;
}

export function ConnectionsCard() {
  const t = useT();
  const format = useFormat();
  const queryClient = useQueryClient();
  const flash = useFlash();
  const connections = useQuery({ queryKey: CONNECTIONS_KEY, queryFn: api.me.connections });
  const providers = useQuery({ queryKey: ['auth', 'providers'], queryFn: api.auth.providers, staleTime: 10 * 60_000 });
  const done = (data: Connections) => queryClient.setQueryData(CONNECTIONS_KEY, data);
  const unlink = useMutation({ mutationFn: (provider: 'discord' | 'steam') => api.me.unlink(provider), onSuccess: done });
  const sync = useMutation({ mutationFn: api.me.syncSteam, onSuccess: done });

  if (!connections.data) return <Skeleton height={180} />;
  const { discord, steam } = connections.data;

  return (
    <section className={shared.card}>
      <header className={shared.head}>
        <span className={shared.icon}>
          <Icon name="link" size={18} />
        </span>
        <div>
          <h3>{t.security.connections}</h3>
          <p>{t.security.connectionsText}</p>
        </div>
      </header>
      {flash ? <p className={flash.kind === 'ok' ? shared.ok : shared.error}>{flash.text}</p> : null}

      <ul className={styles.list}>
        <li className={styles.row}>
          <span className={cx(styles.logo, styles.discord)}>
            <DiscordLogo size={20} />
          </span>
          <span className={styles.text}>
            <strong>Discord</strong>
            {discord ? (
              <span>
                @{discord.username} · {t.security.linked} <RelativeTime iso={discord.connectedAt} />
              </span>
            ) : (
              <span>{t.security.discordPitch}</span>
            )}
          </span>
          {discord ? (
            <Button size="sm" variant="ghost" onClick={() => unlink.mutate('discord')} loading={unlink.isPending && unlink.variables === 'discord'} disabled={!connections.data.canUnlinkDiscord}>
              {t.security.disconnect}
            </Button>
          ) : providers.data?.discord ? (
            <a href={discordStartUrl('link', '/settings')} className={styles.connect}>
              {t.security.connect}
            </a>
          ) : (
            <span className={styles.soon}>{t.security.comingSoon}</span>
          )}
        </li>
        {discord && !connections.data.canUnlinkDiscord ? (
          <li className={styles.note}>
            {t.security.discordOnly} <Link href="/forgot-password">{t.security.discordOnlyLink}</Link> {t.security.discordOnlyRest}
          </li>
        ) : null}

        <li className={styles.row}>
          <span className={cx(styles.logo, styles.steam)}>
            <Icon name="gamepad" size={20} />
          </span>
          <span className={styles.text}>
            <strong>Steam</strong>
            {steam ? (
              <span>
                <a href={steam.profileUrl} target="_blank" rel="noopener noreferrer">
                  {steam.personaName ?? `Steam ${steam.id.slice(-6)}`}
                </a>{' '}
                · {t.security.linked} <RelativeTime iso={steam.connectedAt} />
              </span>
            ) : (
              <span>{t.security.steamPitch}</span>
            )}
          </span>
          {steam ? (
            <Button size="sm" variant="ghost" onClick={() => unlink.mutate('steam')} loading={unlink.isPending && unlink.variables === 'steam'}>
              {t.security.disconnect}
            </Button>
          ) : providers.data?.steam ? (
            <a href={steamStartUrl('/settings')} className={styles.connect}>
              {t.security.connect}
            </a>
          ) : null}
        </li>
        {steam && connections.data.steamGamesAvailable ? (
          <li className={styles.games}>
            <div className={styles.gamesHead}>
              <span>
                {steam.games.length > 0 ? format.fill(t.security.steamGames, { count: steam.games.length }) : t.security.noSteamGames}
                {steam.gamesSyncedAt ? (
                  <>
                    {' '}
                    · {t.security.synced} <RelativeTime iso={steam.gamesSyncedAt} />
                  </>
                ) : null}
              </span>
              <Button size="sm" variant="ghost" icon="refresh" onClick={() => sync.mutate()} loading={sync.isPending}>
                {t.security.refresh}
              </Button>
            </div>
            {steam.games.length > 0 ? (
              <ul className={styles.chips}>
                {steam.games.slice(0, 10).map(({ game, hours }) => (
                  <li key={game.id}>
                    <Link href={`/games/${game.slug}`} className={styles.chip} style={{ '--accent': game.accent } as CSSProperties}>
                      <i aria-hidden>{game.monogram}</i>
                      {game.title}
                      {hours > 0 ? <span>{fill(t.security.hoursShort, { hours })}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.hint}>{t.security.privateSteam}</p>
            )}
          </li>
        ) : null}
      </ul>
      {unlink.error || sync.error ? <p className={shared.error}>{(unlink.error ?? sync.error)!.message}</p> : null}
    </section>
  );
}
