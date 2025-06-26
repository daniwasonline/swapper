import proxmoxApi from "proxmox-api";
import { App } from "../..";
import Swapper from "../../lib/swapper";
import { requests } from "../../queues";

const overview = (app: App) => app.get("/api/v1/qm/:id", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const qm = await swapper.machines.all();

  if (!qm) {
    return ctx.json({
      success: false,
      error: "Machine not found",
    });
  }

  const machine = await qm.find((qm) => qm.id === parseInt(ctx.req.param("id")))?.overview;

  return ctx.json({
    success: true,
    data: machine
  });
});

const swap = (app: App) => app.post("/api/v1/qm/:id/swap", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const qm = await swapper.machines.all();

  if (!qm) {
    return ctx.json({
      success: false,
      error: "Machine not found",
    });
  };

  const machine = await qm.find((qm) => qm.id === parseInt(ctx.req.param("id")))?.overview;

  if (!machine) {
    return ctx.json({
      success: false,
      error: "Machine not found",
    });
  };

  if (machine.status !== "stopped") {
    return ctx.json({
      success: false,
      error: "Machine is already online! Use /api/v1/active/sync to sync devices, or /api/v1/qm/active/stop to stop machine",
    });
  }

  requests.add(ctx.req.param("id"), {});

  return ctx.json({
    success: true,
    message: `Successfully queued swap request for ${machine.name} (${machine.id})`,
  });
});

// apply all to app
export default (app: App) => {
  overview(app);
  swap(app);
};