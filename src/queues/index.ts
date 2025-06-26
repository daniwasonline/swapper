import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import chalk from "chalk";

// Connection stuff
export const connection = new IORedis(process.env.KV_URI ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Requests: Queue for QM swap requests
export const requests = new Queue("requests", {
  connection: connection,
  defaultJobOptions: {
    removeOnComplete: true,
  },
});

// Active: Queue for jobs relating to the active QM
export const active = new Queue("active", {
  connection: connection,
  defaultJobOptions: {
    removeOnComplete: true,
  },
});

// Cache: Store QMs in KV for easy access
export enum CacheJobStatus {
  MasterlistUpdate = "masterlistUpdate",
  ActiveQMsUpdate = "activeQMsUpdate",
};

export const cache = new Queue("cache", {
  connection: connection,
  defaultJobOptions: {
    removeOnComplete: true,
  },
});