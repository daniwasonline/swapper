# My Desktop Machine
This entire md file will go into the notes section of the QM in the VE web UI (which supports markdown).

You can find the JSON source in `desktop-kbm.json5`.

## IP Address
Pretend that this section contains notes about the IP address of the machine:
- Local: 192.168.1.100
- External: 100.100.100.102

## Specs
- CPU: host @ 12c
- RAM: 32g
- Storage 1 (for boot, located on primary SSD used for proxmox): 64g
- Storage 2 (for games, located on bigger 2TB SSD): 256g

## Swapper configuration
```json
---swapper.config.start---
{
  name: "My Personal Desktop",
  devices: [
    {
      // Keyboard
      // Swapper recognises PCI/PCIe* ("pci") and USB ("usb") devices (* PCI is currently not implemented as of v2.0, but will be in the future)
      type: "usb",
      // This is the device ID, as defined in the host's configuration (usb0-4 supported on all, usb0-14 only on VE 7.1+ and ostype windows 8+
      // and linux 2.6+; see https://pve.proxmox.com/pve-docs/api-viewer/#/nodes/%7Bnode%7D/qemu/%7Bvmid%7D/config : usb[n] for more details)
      as: "usb11",
      // This is the value of the device configuration; uses Proxmox config syntax (see above docs for more details)
      // This device uses a host USB ID (i.e. passthrough a specific DEVICE on your motherboard to the machine, regardless of port)
      // Use the command `lsusb` to find the ID of your device, or recreate configuration in VE web UI and copy here
      value: "host=05ac:024f",
    },
    {
      // Mouse
      type: "usb",
      as: "usb10",
      // Device uses mapping for this one
      // Configure mappings in VE web UI (Datacentre -> Resource Mappings)
      value: "mapping=MyMouse",
    },
    {
      // Bluetooth adapter
      type: "usb",
      as: "usb11",
      // This device uses a host USB *port* ID (i.e. passthrough a specific PORT on your motherboard to the machine)
      // idek how to find this one using a command, you can recreate this in the VE web UI and copy here
      value: "host=1-9",
    },
  ],
}
---swapper.config.end---
```