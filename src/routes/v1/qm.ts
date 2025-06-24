import proxmoxApi from "proxmox-api";
import { App } from "../..";
import Swapper from "../../lib/swapper";

const listRoute = (app: App) => app.get("/api/v1/qm/list", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const machines = await swapper.machines.all();

  console.log(machines);

  return ctx.json(machines);
});

const getRoute = (app: App) => app.get("/api/v1/qm/:id", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const qm = (await swapper.machines.all()).data.find((qm) => qm.id === parseInt(ctx.req.param("id")));

  if (!qm) {
    return ctx.json({
      success: false,
      error: "Machine not found",
    });
  }

  const machine = await qm.fetchSwapperConfiguration();

  return ctx.json(machine);
});

// apply all to app
export default (app: App) => {
  listRoute(app);
  getRoute(app);
};