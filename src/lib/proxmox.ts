import { proxmoxApi } from "proxmox-api";

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

export type VEInstance = ReturnType<typeof proxmoxApi>;

export const veMiddleware = async () => {
  return createMiddleware(async (ctx, next) => {
    const api = proxmoxApi({
      host: process.env.VE_URL ?? "https://192.168.1.100:8006/",
      tokenID: process.env.VE_TOKEN_ID ?? "",
      tokenSecret: process.env.VE_TOKEN_SECRET ?? "",
    });

    ctx.set("ve", api)
    await next();
  });
};