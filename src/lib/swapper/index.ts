import { Proxmox } from "proxmox-api";
import { kv, MasterList, valkey } from "../kv";
import { VEInstance } from "../proxmox";
import { QMConfig, QMDevice } from "./parsers";
import { sleep } from "bun";
import chalk from "chalk";

export enum QMStatus {
  Stopped = "stopped",
  Running = "running",
  Unknown = "unknown",
}

export type ApiQM = Proxmox.nodesQemuConfigVmConfig & {
  id?: number;
  node?: string;
  swapper?: QMConfig;
}

export default class Swapper {
  ve: VEInstance;
  machines: SwapperQMManager;
  cluster: SwapperClusterManager;

  constructor(ve: VEInstance) {
    this.ve = ve;
    this.machines = new SwapperQMManager(this);
    this.cluster = new SwapperClusterManager(this);
  }
}

export class SwapperClusterManager {
  swapper: Swapper;
  constructor(swapper: Swapper) {
    this.swapper = swapper;
  }

  async mappings(type: "usb" | "pci") {
    const mappings = await this.swapper.ve.cluster.mapping[type].$get();
    const nodes = [...new Set(mappings.map((mapping) => mapping?.map?.join(",")?.split(",")?.find((setting) => setting?.startsWith("node="))?.split("=")[1]))].filter((node) => node !== undefined);

    const completeNodeStatus = await Promise.all(nodes.map(async (node) => {
      const qmMappings = await this.swapper.ve.nodes.$(node).hardware[type].$get();
      return {
        nodeId: node,
        devices: qmMappings
      };
    }));

    if (type === "usb") {
      const completeMappings = mappings.map((mapping) => {
        // check if mapping is present in completeNodeStatus
        const usbId = mapping.map.join(",").split(",").find((setting) => setting.startsWith("id="))?.split("=")[1];
        const connected = completeNodeStatus.some((node) => {
          return node.devices.find((dev) => dev.vendid === usbId?.split(":")[0] && dev.prodid === usbId?.split(":")[1])
        });
        return {
          ...mapping,
          connectedToHost: connected,
          devId: usbId,
        };
      });

      return completeMappings;
    };
    // TODO: Support PCI devices
  }
}

export class SwapperQMManager {
  swapper: Swapper;

  constructor(swapper: Swapper) {
    this.swapper = swapper;
  }

  get active() {
    return kv.get<number[]>("qm:active")?.then(async (arr: number[] | undefined) => {
      if (!arr) return null;
      // get first active qm
      const id = typeof arr === "number" ? arr : arr[0];
      const config = await kv.get<ApiQM>(`qm:${id}`);

      if (!config) return null;

      return new SwapperQM({
        swapper: this.swapper,
        id: config?.id ?? -1,
        name: config?.name ?? "unknown",
        nodeId: config?.node ?? "unknown",
        tags: config?.tags?.split(";") ?? [],
        status: config?.status as QMStatus ?? QMStatus.Unknown,
      });
    }) ?? null;
  }

  async all({ cache = true } = {}): Promise<SwapperQM[]> {
    const machines = (await kv.get<MasterList>("qm:masterlist") ?? []).map(async (m) => {
      const config = cache ? await kv.get<ApiQM>(`qm:${m.id}`) : await this.swapper.ve.nodes.$(m.node).qemu.$(m.id).config.$get();
      return new SwapperQM({
        swapper: this.swapper,
        id: config?.id ?? -1,
        name: config?.name ?? "unknown",
        nodeId: config?.node ?? "unknown",
        tags: config?.tags?.split(";") ?? [],
        status: config?.status as QMStatus ?? QMStatus.Unknown,
      });
    });

    // get promises returned
    return Promise.all(machines);
  }
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
  };

  get overview(): Promise<ApiQM | undefined> {
    return kv.get<ApiQM>(`qm:${this.id}`);
  };

  async forceMetaUpdate() {
    const config = await this.overview;
    this.name = config?.name ?? this.name;
    this.nodeId = config?.node ?? this.nodeId;
    this.tags = config?.tags?.split(";") ?? this.tags;
    this.status = config?.status as QMStatus ?? this.status;
  }

  async halt() {
    await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).status.stop.$post({
      timeout: 100,
    });

    return { success: true };
  };

  async shutdown() {
    await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).status.shutdown.$post({
      forceStop: true, // force stop the machine
      timeout: 100
    });

    // wait until the machine is actually stopped by checking qm:active every 15sec
    let active = await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).status.current.$get();
    while (active.status === "running") {
      await sleep(2500);
      active = await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).status.current.$get();
    };

    return { success: true };
  };

  async start() {
    await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).status.start.$post({
      timeout: 0,
    })

    return { success: true };
  };

  async removeDevices() {
    const config = await this.overview;
    const currentConfig = await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).config.$get();

    if (!config || !currentConfig) return { success: false };

    // cycle through all pci and usb devices, find ones with values containing "swapper=true"
    const currentDevices = Object.keys(currentConfig).filter((key) => key.startsWith("usb") || key.startsWith("hostpci"));

    // build list of devices to remove
    // devices to remove are ones that ARE in the config but aren't connected
    const toRemove = currentDevices
      .filter((dev) => config.swapper?.devices?.find((device) => device.as === dev)) // find devices in config
      .filter((dev) => !config.swapper?.devices?.find((device) => device.as === dev)?.connectedToHost); // find devices that aren't connected

    if (toRemove.length > 0) {
      await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).config.$post({
        delete: toRemove.join(","),
      });
    };
  }

  async syncDevices() {
    const config = await this.overview;
    const currentConfig = await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).config.$get();

    if (!config || !currentConfig) return { success: false };

    // cycle through all pci and usb devices, find ones with values containing "swapper=true"
    const currentDevices = Object.keys(currentConfig).filter((key) => key.startsWith("usb") || key.startsWith("hostpci"));

    // build list of devices to remove
    // devices to remove are ones that ARE in the config but aren't connected
    const toRemove = currentDevices
      .filter((dev) => config.swapper?.devices?.find((device) => device.as === dev)) // find devices in config
      .filter((dev) => !config.swapper?.devices?.find((device) => device.as === dev)?.connectedToHost); // find devices that aren't connected

    if (toRemove.length > 0) {
      await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).config.$post({
        delete: toRemove.join(","),
      });
    };

    const toSync = config.swapper?.devices.filter((dev) => dev.connectedToHost) ?? [];

    if (toSync?.length > 0) {
      await this.swapper.ve.nodes.$(this.nodeId).qemu.$(this.id).config.$post({
        ...toSync?.reduce((acc: Record<string, string>, device: QMDevice) => {
          acc[device.as] = device.value;
          return acc;
        }, {}),
      });
    }

    return { success: true };
  };
};