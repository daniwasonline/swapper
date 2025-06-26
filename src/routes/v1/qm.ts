import { App } from "../..";
import Swapper from "../../lib/swapper";

const listRoute = (app: App) => app.get("/api/v1/qm", async (ctx) => {
  const swapper: Swapper = new Swapper(ctx.var.ve);
  const machines = await swapper.machines.all();

  return ctx.json({
    success: true,
    data: machines,
  });
});

// apply all to app
export default (app: App) => {
  listRoute(app);
};