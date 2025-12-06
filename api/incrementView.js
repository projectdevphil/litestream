import { Redis } from '@upstash/redis';
export const config = { runtime: 'edge' };
export default async function handler(request) {
  try {
    const url = new URL(request.url);
    const channel = url.searchParams.get('channel');
    if (!channel) return new Response('Missing channel', { status: 400 });
    const redis = Redis.fromEnv();
    await redis.zincrby('global_top_watch', 1, channel);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
