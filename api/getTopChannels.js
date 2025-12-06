import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.STORAGE_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORAGE_TOKEN,
    });

    const topChannels = await redis.zrange('global_top_watch', 0, 4, { rev: true });
    
    return new Response(JSON.stringify(topChannels), {
      status: 200,
      headers: { 
        'content-type': 'application/json',
        'Cache-Control': 's-maxage=5, stale-while-revalidate=10' 
      }
    });
  } catch (error) {
    console.error("Redis Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
