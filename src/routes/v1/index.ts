import qm from "./qm";
import type { App } from "../..";
import qmIndividual from "./qmIndividual";
import active from "./active";

// apply all to app
export default (app: App) => {
  qm(app);
  qmIndividual(app);
  active(app);
};