import { Job, QueueEvents, Worker } from "bullmq";
import Swapper, { ApiQM, QMStatus, SwapperQM } from "../../lib/swapper";
import { createVeApi } from "../../lib/proxmox";
import { kv, MasterList } from "../../lib/kv";
import { connection, CacheJobStatus, } from "..";
import { getQMConfig } from "../../lib/swapper/parsers";
import chalk from "chalk";
import { Proxmox } from "proxmox-api";
import { active } from "..";
import { ActiveJobType } from "./active";

export enum CacheJobType {
  UpdateCache = "update-cache",
  EventListener = "event-listener",
}

export enum EventListenerEvent {
  UsbDeviceAttach = "usb-device-attach",
  UsbDeviceDetach = "usb-device-detach",
  PciDeviceAttach = "pci-device-attach",
  PciDeviceDetach = "pci-device-detach",
};

export const cacheHandler = new Worker("cache", async (job: Job) => {
  if (job?.name === "update-cache") {
    return await updateCache(job);
  } else if (job?.name === "event-listener") {
    return await eventListener(job);
  }
}, { connection, autorun: true });


const updateCache = async (job: Job) => {
  const swapper = new Swapper(createVeApi())

  const machines = await swapper.ve.cluster.resources.$get({
    type: "vm"
  }).then((m) => m.filter((m) => m.tags.split(";").includes("swapper")));

  job.updateProgress({
    status: CacheJobStatus.ActiveQMsUpdate,
    meta: null
  });

  // set masterlist
  await kv.set<MasterList>("qm:masterlist", machines.map((m) => ({
    id: m.vmid ?? -1,
    node: m.node ?? "unknown",
  })).filter((m) => m.id !== -1 && m.node !== "unknown"));

  // find running qms and compile into array (THERE SHOULD ALWAYS ONLY BE ONE)
  await kv.set("qm:active", [machines.filter((m) => m.status !== "stopped").map((m) => m.vmid)].flat());
  // update qms in cache
  for (const machine of machines) {
    const details = await swapper.ve.nodes.$(machine.node ?? "unknown").qemu.$(machine.vmid ?? -1).config.$get();

    const qm = new SwapperQM({
      swapper,
      id: machine.vmid ?? -1,
      name: machine.name ?? "unknown",
      nodeId: machine.node ?? "unknown",
      tags: machine.tags.split(";"),
      status: machine.status as QMStatus ?? QMStatus.Unknown,
    });

    let swapperConf = await getQMConfig(swapper, details.description ?? "");

    const overview: ApiQM = {
      ...(details),
      id: machine.vmid ?? -1,
      node: machine.node ?? "unknown",
      swapper: swapperConf.success ? swapperConf.data : {
        name: machine.name ?? "unknown",
        devices: [],
      },
      status: machine.status as QMStatus ?? QMStatus.Unknown,
    }

    await kv.set(`qm:${qm.id}`, JSON.stringify(overview));
  };
};

const eventListener = async (job: Job) => {
  const swapper = new Swapper(createVeApi());

  const currentValues = {
    usb: await kv.get<Proxmox.clusterMappingUsbIndex[]>("usb:mappings"),
    pci: await kv.get<Proxmox.clusterMappingPciIndex[]>("pci:mappings"),
  };

  const newValues = {
    usb: await swapper.cluster.mappings("usb"),
    pci: await swapper.cluster.mappings("pci"),
  };

  const changes = {
    usb: newValues.usb?.filter((newValue) => currentValues.usb?.find((currentValue) => currentValue.id === newValue.id)?.connectedToHost !== newValue.connectedToHost) ?? [],
    pci: newValues.pci?.filter((newValue) => currentValues.pci?.find((currentValue) => currentValue.devId === newValue.devId)?.connectedToHost !== newValue.connectedToHost) ?? [],
  };

  if (changes.usb.length > 0) {
    await kv.set("usb:mappings", newValues.usb);
    changes.usb.forEach((change) => {
      job.updateProgress({
        name: CacheJobType.EventListener,
        event: change.connectedToHost ? EventListenerEvent.UsbDeviceAttach : EventListenerEvent.UsbDeviceDetach,
        device: change.id,
      });
    });
  } if (changes.pci.length > 0) {
    await kv.set("pci:mappings", newValues.pci);
    changes.pci.forEach((change) => {
      job.updateProgress({
        name: CacheJobType.EventListener,
        event: EventListenerEvent.PciDeviceAttach,
        device: change.devId,
      });
    });
  };

  if ((changes.usb.length > 0 || changes.pci.length > 0)) {
    active.add(ActiveJobType.DeviceSync, {}, {
      delay: 2000
    });
  }

  return { success: true, changes: changes };
};

const cacheEvents = new QueueEvents("cache", { connection: connection });

cacheEvents.on("error", async (job) => {
  console.log(`${chalk.red("Error")} in ${chalk["bold"]("cache")}`, job);
});

cacheEvents.on("progress", async ({ jobId, data }: { jobId: string, data: any }) => {
  if (data?.name === CacheJobType.EventListener) {
    const prefix = `[${chalk["red"]["bold"]("HOST")}]`;
    if (data?.event === EventListenerEvent.UsbDeviceAttach) {
      console.log(`${prefix} ${chalk["green"]("Attached")} USB device ${chalk["blue"]["bold"](data?.device)}`);
    } else if (data?.event === EventListenerEvent.UsbDeviceDetach) {
      console.log(`${prefix} ${chalk["red"]("Detached")} USB device ${chalk["blue"]["bold"](data?.device)}`);
    } else if (data?.event === EventListenerEvent.PciDeviceAttach) {
      console.log(`${prefix} ${chalk["green"]("Attached")} PCI device ${chalk["blue"]["bold"](data?.device)}`);
    } else if (data?.event === EventListenerEvent.PciDeviceDetach) {
      console.log(`${prefix} ${chalk["red"]("Detached")} PCI device ${chalk["blue"]["bold"](data?.device)}`);
    }
  };
});