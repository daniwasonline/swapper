import type { ElysiaApp } from '../../index';

export const apiInformation = {
  version: "v1",
  tested: {
    "proxmox-ve": "8.0...8.4.1"
  }
}

export default (app: ElysiaApp) => app.get('/', apiInformation);

