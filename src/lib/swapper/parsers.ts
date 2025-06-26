import typia, { IValidation } from "typia";
import { parse } from "json5";
import Swapper from ".";

// type union for determining usb device name conventions vs pcie device name conventions
export interface USBDevice {
  type: "usb",
  as: `usb${number}`,
}

export interface PCIDevice {
  type: "pci",
  as: `hostpci${number}`,
}

export type QMDevice = (USBDevice | PCIDevice) & {
  value: string;
  otherOptions?: Record<string, any>;
  connectedToHost: boolean;
}

export interface QMConfig {
  name: string;
  devices: QMDevice[];
}

export const getQMConfig = async (swapper: Swapper, config: string): Promise<IValidation<QMConfig>> => {
  const conf = config.substring(config.indexOf("--swapper.config.start--") + 25, config.indexOf("--swapper.config.end--"));

  if (!conf) {
    return {
      success: false,
      data: config,
      errors: [
        {
          path: "",
          expected: "A valid QMConfig marked with --swapper.config.start-- and --swapper.config.end--",
          value: config,
        }
      ]
    }
  };

  try {
    const parsed = parse(conf);
    const usbMappings = await swapper.cluster.mappings("usb");
    const pciMappings = await swapper.cluster.mappings("pci");
    parsed.devices = parsed.devices.map((dev: QMDevice) => {
      if (dev.type === "usb") {
        return {
          ...dev,
          connectedToHost: usbMappings?.find((mapping) => mapping.id === dev.value.split(",").find((setting) => setting.startsWith("mapping="))?.split("=")[1])?.connectedToHost
        }
      } else if (dev.type === "pci") {
        return {
          ...dev,
          connectedToHost: pciMappings?.find((mapping) => mapping.devId === dev.as)?.connectedToHost
        }
      } else {
        return dev;
      };
    });

    return {
      success: true,
      data: parsed,
    };
  } catch (e) {
    return {
      success: false,
      data: conf,
      errors: [
        {
          path: "",
          expected: "A valid QMConfig marked with --swapper.config.start-- and --swapper.config.end--",
          value: config,
        }
      ]
    }
  }
};

export const getQMDescription = (description: string): string => description.substring(0, description.indexOf("--swapper.config.start--"));