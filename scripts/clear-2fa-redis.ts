import 'dotenv/config';
import { redis } from '../src/lib/redis';

(async () => {
  const userId = 2;
  const keys = [`2fa_setup_verify:${userId}`, `2fa_setup_ttl:${userId}`];
  for (const k of keys) {
    const v = await redis.get(k);
    const del = await redis.del(k);
    console.log(`${k} → val=${v ? `(${v.slice(0, 8)}…)` : 'null'}, deleted=${del}`);
  }
  await redis.quit();
})();
