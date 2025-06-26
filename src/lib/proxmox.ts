import { proxmoxApi } from "proxmox-api";

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

export type VEInstance = ReturnType<typeof proxmoxApi>;

const host = new URL(process.env.VE_URL ?? "https://192.168.1.100:8006/");

export const createVeApi = () => proxmoxApi({
  host: `${host.host}`,
  tokenID: process.env.VE_TOKEN_ID ?? "",
  tokenSecret: process.env.VE_TOKEN_SECRET ?? "",
});

export const veMiddleware = async () => {
  return createMiddleware(async (ctx, next) => {
    const api = createVeApi();

    ctx.set("ve", api)
    await next();
  });
};