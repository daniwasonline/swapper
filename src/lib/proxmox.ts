import { ProxmoxEngine } from "proxmox-api";
import type { ProxmoxEngineOptions } from "proxmox-api";

export const GenerateTicket = async (opts: ProxmoxEngineOptions) => {
  const engine = new ProxmoxEngine({
    ...opts
  });

  const ticket = await engine.getTicket();

  return ticket;
}