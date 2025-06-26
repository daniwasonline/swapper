import { App } from "../..";
import Swapper from "../../lib/swapper";
import { active as activeQueue } from "../../queues";
import { ActiveJobType } from "../../queues/workers/active";

const viewActive = (app: App) => app.get("/api/v1/active", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const active = await swapper.machines.active;

  if (!active) {
    return ctx.json({
      success: false,
      error: "No active QM found",
    });
  }

  return ctx.json({
    success: true,
    data: await active.overview
  });
});

const syncDevices = (app: App) => app.post("/api/v1/active/sync", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const active = await swapper.machines.active;

  if (!active) {
    return ctx.json({
      success: false,
      error: "No active QM found",
    });
  };

  activeQueue.add(ActiveJobType.DeviceSync, {});

  return ctx.json({
    success: true,
  });
});

const stop = (app: App) => app.post("/api/v1/active/stop", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const active = await swapper.machines.active;

  if (!active) {
    return ctx.json({
      success: false,
      error: "No active QM found",
    });
  };

  activeQueue.add(ActiveJobType.Stop, {});

  return ctx.json({
    success: true,
  });
});

const halt = (app: App) => app.post("/api/v1/active/halt", async (ctx) => {
  if (process.env.POWER_HALT !== "true") {
    return ctx.json({
      success: false,
      error: "Security: Halting is disabled",
    });
  };
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const active = await swapper.machines.active;

  if (!active) {
    return ctx.json({
      success: false,
      error: "No active QM found",
    });
  };

  activeQueue.add(ActiveJobType.HangingStop, {});

  return ctx.json({
    success: true,
  });
});

// apply all to app
export default (app: App) => {
  viewActive(app);
  syncDevices(app);
  stop(app);
  halt(app);
};