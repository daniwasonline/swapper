import { Job, QueueEvents, Worker } from "bullmq";
import Swapper from "../../lib/swapper";
import { createVeApi } from "../../lib/proxmox";
import { connection } from "..";
import chalk from "chalk";

export enum ActiveJobType {
  DeviceSync = "deviceSync",
  Stop = "stop",
  HangingStop = "stop",
}

export enum ActiveJobStatus {
  Waiting = "waiting",
  Complete = "complete",
}

export const activeHandler = new Worker("active", async (job: Job) => {
  const swapper = new Swapper(createVeApi());
  const active = await swapper.machines.active;
  if (!active) {
    return {
      success: false,
      error: "No active QM found",
    };
  };

  if (job.name === ActiveJobType.DeviceSync) {
    return await deviceSync(job, swapper);
  } else if (job.name === ActiveJobType.Stop) {
    return await stop(job, swapper, false);
  } else if (job.name === ActiveJobType.HangingStop) {
    return await stop(job, swapper, true);
  } else {
    return;
  };
}, { connection });

const deviceSync = async (job: Job, swapper: Swapper) => {
  const active = await swapper.machines.active;

  job.updateProgress({
    name: ActiveJobType.DeviceSync,
    status: ActiveJobStatus.Waiting,
    meta: {
      id: active?.id,
      name: active?.name,
    }
  });

  await active?.syncDevices();

  job.updateProgress({
    name: ActiveJobType.DeviceSync,
    status: ActiveJobStatus.Complete,
    meta: {
      id: active?.id,
      name: active?.name,
    }
  });

  return { success: true };
};

const stop = async (job: Job, swapper: Swapper, hanging: boolean = false) => {
  const active = await swapper.machines.active;

  if (hanging) {
    job.updateProgress({
      name: ActiveJobType.HangingStop,
      status: ActiveJobStatus.Waiting,
      meta: {
        id: active?.id,
        name: active?.name,
      }
    });
    await active?.halt();
    job.updateProgress({
      name: ActiveJobType.HangingStop,
      status: ActiveJobStatus.Complete,
      meta: {
        id: active?.id,
        name: active?.name,
      }
    });
  } else {
    job.updateProgress({
      name: ActiveJobType.Stop,
      status: ActiveJobStatus.Waiting,
      meta: {
        id: active?.id,
        name: active?.name,
      }
    });

    await active?.shutdown().catch((e) => {
      console.log(chalk.red("Error"), e);
    });
    await active?.removeDevices();

    job.updateProgress({
      name: ActiveJobType.Stop,
      status: ActiveJobStatus.Complete,
      meta: {
        id: active?.id,
        name: active?.name,
      }
    });
  };

  return { success: true };
};

const activeEvents = new QueueEvents("active", { connection: connection });

activeEvents.on("progress", async ({ jobId, data }: { jobId: string, data: any }) => {
  const prefix = `[QM ${chalk["cyan"]["bold"](data.meta.id)}]`;
  if (data?.name === ActiveJobType.DeviceSync) {
    if (data?.status === ActiveJobStatus.Complete) {
      console.log(`${prefix} Executed job ${chalk["blue"]["bold"]("Sync Devices")}`);
    };
  } else if (data?.name === ActiveJobType.Stop) {
    if (data?.status === ActiveJobStatus.Waiting) {
      console.log(`${prefix} Executing job ${chalk["blue"]["bold"]("Stop Machine")}`);
    } else if (data?.status === ActiveJobStatus.Complete) {
      console.log(`${prefix} Executed job ${chalk["blue"]["bold"]("Stop Machine")}`);
    };
  } else if (data?.name === ActiveJobType.HangingStop) {
    if (data?.status === ActiveJobStatus.Waiting) {
      console.log(`${prefix} Executing job ${chalk["blue"]["bold"]("Force-Stop Machine")}`);
    } else if (data?.status === ActiveJobStatus.Complete) {
      console.log(`${prefix} Executed job ${chalk["blue"]["bold"]("Force-Stop Machine")}`);
    };
  };
});