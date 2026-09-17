import "server-only";

import { Redis } from "@upstash/redis";

export class RedisConfigurationError extends Error {
  constructor() {
    super(
      "Redis is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.",
    );
    this.name = "RedisConfigurationError";
  }
}

let client: Redis | null = null;

export function getRedisClient() {
  if (client) {
    return client;
  }

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new RedisConfigurationError();
  }

  client = new Redis({
    url,
    token,
    enableTelemetry: false,
  });

  return client;
}