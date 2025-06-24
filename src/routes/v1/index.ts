import type { Hono } from "hono";

import qm from "./qm";
import app from "../..";
import type { App } from "../..";

// apply all to app
export default (app: App) => {
  qm(app);
};