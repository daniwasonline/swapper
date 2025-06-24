import { VEInstance } from "./proxmox";

enum QMStatus {
  Stopped = "stopped",
  Running = "running",
  Unknown = "unknown",
}

export default class Swapper {
  ve: VEInstance;
  machines: SwapperQMManager;

  constructor(ve: VEInstance) {
    this.ve = ve;
    this.machines = new SwapperQMManager(this);
  }
}

export class SwapperQMManager {
  swapper: Swapper;

  constructor(swapper: Swapper) {
    this.swapper = swapper;
  }

  async all() {
    const machines = (await this.swapper.ve.cluster.resources.$get({
      type: "vm"
    })).filter((m) => m.tags.split(";").includes("swapper")).map((m) => {
      return new SwapperQM({
        swapper: this.swapper,
        id: m.vmid ?? -1,
        name: m.name ?? "unknown",
        nodeId: m.node ?? "unknown",
        tags: m.tags.split(";"),
        status: m.status as QMStatus ?? QMStatus.Unknown,
      });
    });

    return {
      success: true,
      data: machines,
    }
  };
};

export class SwapperQM {
  swapper: Swapper;
  id: number;
  name: string;
  nodeId: string;
  tags: string[];
  status: QMStatus;

  constructor({
    swapper,
    id,
    name,
    nodeId,
    tags,
    status,
  }: {
    swapper: Swapper;
    id: number;
    name: string;
    nodeId: string;
    tags: string[];
    status: QMStatus;
  }) {
    this.swapper = swapper;
    // convert to number
    this.name = name;
    this.id = id;
    this.nodeId = nodeId;
    this.tags = tags;
    this.status = status;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      nodeId: this.nodeId,
      tags: this.tags,
      status: this.status,
    };
  }

  async fetchVMConfiguration() {
    const machine = await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).config.$get();

    return {
      success: true,
      data: machine,
    }
  };

  async fetchSwapperConfiguration() {
    const config = (await this.fetchVMConfiguration()).data.description ?? "";

    // find --swapper.config.start-- and --swapper.config.end--
    const start = config.indexOf("--swapper.config.start--");
    const end = config.indexOf("--swapper.config.end--");

    // check if we found both
    if (start === -1 || end === -1) {
      return {
        error: "Could not find start and end markers",
      };
    }

    // get the config between the two
    const configBetween = config.substring(start + 25, end);

    try {
      return {
        success: true,
        data: JSON.parse(configBetween)
      };
    } catch (e) {
      return {
        error: e,
      };
    };
  };
}