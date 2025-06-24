import { Hono } from 'hono';
import { join } from 'path';

// Routes
import v1 from "./routes/v1";
import { veMiddleware, VEInstance } from './lib/proxmox';
import { ProxmoxEngine } from 'proxmox-api';

type Variables = {
  "ve": VEInstance;
}

const app = new Hono<{ Variables: Variables }>();
export type App = typeof app;

// we're going to ask for a NON-PRIVILEGED token for root@pam
// this is better than user/pass (easy revocation) but 
// i cba to figure out the actual perms needed for non-
// root. open a PR if you figured this out
app.use(await veMiddleware());

v1(app);

console.log(app.routes);

export default app;