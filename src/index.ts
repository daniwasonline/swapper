import { Elysia } from "elysia";
import { autoroutes } from "elysia-autoroutes";

const app = new Elysia().get("/", () => "Hello Elysia").use(
  autoroutes({
    routesDir: "./router",
    prefix: "/api"
  })
).listen(8555)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type ElysiaApp = typeof app;