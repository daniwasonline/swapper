import { Hono } from 'hono';
import { join } from 'path';
import { bearerAuth } from "hono/bearer-auth";
import { getConnInfo } from 'hono/bun';
import { ipRestriction } from "hono/ip-restriction";

// Routes
import v1 from "./routes/v1";
import { veMiddleware, VEInstance } from './lib/proxmox';

// Queue
import "./queues";
import "./queues/workers";
import "./queues/schedulers";
import chalk from 'chalk';

type Variables = {
  "ve": VEInstance;
}

const app = new Hono<{ Variables: Variables }>();
export type App = typeof app;

if (process.env.SWAPPER_KEY) {
  console.log(`${chalk["green"]["bold"]("INFO")} External API access enabled. Use bearer token to access API.`);
  app.use("*", bearerAuth({ token: process.env.SWAPPER_KEY }));
} else {
  console.warn(`${chalk["red"]["bold"]("WARNING")} No bearer key provided! For security reasons, external API access will be disabled.`);
  console.warn(`${chalk["red"]["bold"]("WARNING")} Set SWAPPER_KEY in your environment in order to enable external API access.`);
  app.use("*", ipRestriction(getConnInfo, {
    denyList: [],
    allowList: ["127.0.0.1", "::1"],
  }, async (remote, ctx) => {
    return ctx.json({
      success: false,
      error: "Security: External API access is disabled. Access is only permitted from localhost.",
      remote: remote.addr,
    });
  }));
}

// we're going to ask for a NON-PRIVILEGED token for root@pam
// this is better than user/pass (easy revocation) but 
// i cba to figure out the actual perms needed for non-
// root. open a PR if you figured this out
app.use(await veMiddleware());

v1(app);

export default {
  host: process.env.HOST ?? "127.0.0.1",
  port: process.env.PORT ?? 8555,
  fetch: app.fetch
}