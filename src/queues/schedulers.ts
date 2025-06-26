import IORedis from "ioredis";
import { cache } from ".";
import { CacheJobType } from "./workers/cache";

const updateCache = await cache.upsertJobScheduler(CacheJobType.UpdateCache, {
  every: 10000,
}, {
  name: CacheJobType.UpdateCache,
});

const eventListener = await cache.upsertJobScheduler(CacheJobType.EventListener, {
  every: 2500,
}, {
  name: CacheJobType.EventListener,
});