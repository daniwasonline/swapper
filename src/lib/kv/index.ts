import Valkey from "iovalkey";
import KeyvValkey from "@keyv/valkey";
import Keyv, { KeyvOptions, StoredDataNoRaw } from "keyv";

// TODO: allow for non-iovalkey store values + custom namespace prefixes
export const valkey = new Valkey(process.env.KV_URI ?? "redis://localhost:6379");

class KeyvExtended {
  _keyv: Keyv;
  constructor(options: KeyvOptions) {
    this._keyv = new Keyv(options);
  };

  async get<T>(key: string): Promise<T | StoredDataNoRaw<T> | undefined> {
    const data = await this._keyv.get<StoredDataNoRaw<T>>(key);

    try {
      return JSON.parse(data as string);
    } catch (e) {
      return data;
    }
  };

  async set<T>(key: string, value: T): Promise<void> {
    await this._keyv.set(key, value);
  };
}


export const kv = new KeyvExtended({
  store: new KeyvValkey(valkey),
  namespace: "swapper.kv",
});

valkey.on("connect", () => {
  console.log("valkey connected");
});

// types for kv
export interface MasterListValue {
  id: number;
  node: string;
}

export type MasterList = MasterListValue[];