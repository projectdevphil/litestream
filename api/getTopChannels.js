import { Redis } from '@upstash/redis';
export const config = { runtime: 'edge' };
export default async function handler(request) {
  try {
    const redis = Redis.fromEnv();
    const topChannels = await redis.zrange('global_top_watch', 0, 4, { rev: true });
    return new Response(JSON.stringify(topChannels), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
