/**
 * Makes an existing account an admin — how the first admin is created on a
 * real server (the seed's dev admin never runs in production).
 *   npm run admin:promote -w apps/api -- player@example.com
 *   docker compose -f docker-compose.prod.yml exec api node dist/scripts/promote-admin.js player@example.com
 */
import { connectMongo, disconnectMongo } from '../core/db/mongo';
import { User } from '../modules/users/user.model';

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) {
  console.error('Usage: promote-admin <email of an existing account>');
  process.exit(1);
}

await connectMongo();
const result = await User.updateOne({ email }, { $set: { role: 'admin' } });
console.log(result.matchedCount === 0 ? `No account with the email ${email} — sign up first, then run this again.` : `${email} is now an admin.`);
await disconnectMongo();
process.exit(result.matchedCount === 0 ? 1 : 0);
