import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env";

export function hashDeviceId(rawDeviceId: string, salt: string = serverEnv.DEVICE_ID_HASH_SALT ?? ""): string {
  return createHash("sha256").update(`${salt}:${rawDeviceId}`).digest("hex");
}
