// http_ece (installed with web-push): the tests decrypt push messages like a phone would.
declare module "http_ece" {
  import type { ECDH } from "node:crypto";
  export function decrypt(buffer: Buffer, params: { version: "aes128gcm"; privateKey: ECDH; authSecret: string }): Buffer;
}
