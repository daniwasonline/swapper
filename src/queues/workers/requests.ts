import { Job, QueueEvents, Worker } from "bullmq";
import Swapper from "../../lib/swapper";
import { createVeApi } from "../../lib/proxmox";
import { connection } from "..";
import chalk from "chalk";

export enum RequestJobStatus {
  Initialise = "initialise",
  RemovingDevices = "removingDevices",
  WaitingForStop = "waitingForStop",
  MachineStop = "machineStop",
  DeviceAttach = "deviceAttach",
  MachineStart = "machineStart",
}

export const requestSwap = new Worker("requests", async (job: Job) => {
  // job.name corresponds to the ID of the QM requesting to be swapped-in
  const id = parseInt(job.name);
  const swapper = new Swapper(createVeApi());

  // if no id is provided / id != number, throw error
  if (isNaN(id)) {
    throw new TypeError("job.name expects number, got " + typeof id);
  };

  // find QM with id
  const machines = await swapper.machines.all();
  const qm = machines.find((qm) => qm.id === Number(id));

  if (!qm) {
    throw new Error("No QM with id " + id + " found");
  };

  // find started qms
  const started = machines.find((qm) => qm.status !== "stopped");

  if (started && started.id === qm.id) {
    throw new Error("QM " + id + " is already online");
  };

  job.updateProgress({
    status: RequestJobStatus.Initialise,
    meta: {
      id,
      name: qm.name
    }
  });

  if (started && started?.id !== qm?.id) {
    // stop all qms
    job.updateProgress({
      status: RequestJobStatus.WaitingForStop,
      meta: {
        id,
        name: qm.name,
        started: {
          name: started?.name,
          id: started?.id
        }
      }
    });

    await started?.shutdown();

    job.updateProgress({
      status: RequestJobStatus.MachineStop,
      meta: {
        id,
        name: qm.name,
        started: {
          name: started?.name,
          id: started?.id
        }
      }
    })

    // remove devices
    job.updateProgress({
      status: RequestJobStatus.RemovingDevices,
      meta: {
        id,
        name: qm.name,
        started: {
          name: started?.name,
          id: started?.id
        }
      }
    });
    await started?.removeDevices();
  }

  // swap devices
  job.updateProgress({
    status: RequestJobStatus.DeviceAttach,
    meta: {
      id,
      name: qm.name
    }
  });

  await qm.syncDevices();

  // start qm
  job.updateProgress({
    status: RequestJobStatus.MachineStart,
    meta: {
      id,
      name: qm.name
    }
  });
  await qm.start();

  return { success: true };
}, { connection });

const requestsEvents = new QueueEvents("requests", { connection: connection });

requestsEvents.on("progress", async ({ jobId, data }: { jobId: string, data: any }) => {
  const prefix = `[QM ${chalk["cyan"]["bold"](data.meta.id)}: ${chalk["cyan"]["bold"](data.meta?.name)}]`;
  if (data?.status === RequestJobStatus.Initialise) {
    console.log(`${prefix} ${chalk.blue("Executing")} QM swap request`);
  } else if (data?.status === RequestJobStatus.RemovingDevices) {
    console.log(`${prefix} ${chalk.magenta("Removing")} devices from QM ${data?.meta?.started?.id} (${data?.meta?.started?.name})`);
  } else if (data?.status === RequestJobStatus.WaitingForStop) {
    console.log(`${prefix} ${chalk.yellow("Waiting")} for QM ${data?.meta?.started?.id} (${data?.meta?.started?.name}) to stop (timeout 100s)...`);
  } else if (data?.status === RequestJobStatus.MachineStop) {
    console.log(`${prefix} ${chalk.green("Stopped")} QM ${data?.meta?.started?.id} (${data?.meta?.started?.name})`);
  } else if (data?.status === RequestJobStatus.DeviceAttach) {
    console.log(`${prefix} ${chalk.magenta("Attaching")} devices`);
  } else if (data?.status === RequestJobStatus.MachineStart) {
    console.log(`${prefix} ${chalk.green("Started")} QM`);
  };
});

requestsEvents.on("error", async (job) => {
  console.log(`${chalk.red("Error")} in ${chalk["bold"]("requests")}`, job);
});