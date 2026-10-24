/**
 * Registers (or updates) the /tgh slash command for the Discord application.
 * Run after changing commands.ts:  npm run discord:register -w apps/api
 * Needs DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN.
 */
import { env } from '../config/env';
import { SLASH_COMMANDS } from '../modules/discord/commands';

if (!env.DISCORD_CLIENT_ID || !env.DISCORD_BOT_TOKEN) {
  console.error('Set DISCORD_CLIENT_ID and DISCORD_BOT_TOKEN first.');
  process.exit(1);
}

const response = await fetch(`https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/commands`, {
  method: 'PUT',
  headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify(SLASH_COMMANDS),
});

if (!response.ok) {
  console.error(`Discord answered ${response.status}: ${await response.text()}`);
  process.exit(1);
}
const registered = (await response.json()) as Array<{ name: string }>;
console.log(`Registered: ${registered.map((command) => `/${command.name}`).join(', ')}`);
console.log(`Interactions endpoint URL to set in the Discord portal: ${env.PUBLIC_WEB_URL}/api/v1/discord/interactions`);
