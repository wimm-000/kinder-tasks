import { argon2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(argon2);
const MEMORY = 65_536;
const PASSES = 3;
const PARALLELISM = 1;
const TAG_LENGTH = 32;

function encode(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

export async function hashChildPin(pin: string) {
  const salt = randomBytes(16);
  const tag = await derive("argon2id", {
    message: Buffer.from(pin),
    nonce: salt,
    parallelism: PARALLELISM,
    tagLength: TAG_LENGTH,
    memory: MEMORY,
    passes: PASSES,
  });
  return `$argon2id$v=19$m=${MEMORY},t=${PASSES},p=${PARALLELISM}$${encode(salt)}$${encode(tag)}`;
}

export async function verifyChildPin(hash: string, pin: string) {
  const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([\w-]+)\$([\w-]+)$/.exec(hash);
  if (!match) return false;
  const memory = Number(match[1]);
  const passes = Number(match[2]);
  const parallelism = Number(match[3]);
  if (
    memory < 8 ||
    memory > MEMORY ||
    passes < 1 ||
    passes > PASSES ||
    parallelism < 1 ||
    parallelism > 4
  )
    return false;
  const salt = Buffer.from(match[4]!, "base64url");
  const expected = Buffer.from(match[5]!, "base64url");
  if (salt.length !== 16 || expected.length !== TAG_LENGTH) return false;
  const actual = Buffer.from(
    await derive("argon2id", {
      message: Buffer.from(pin),
      nonce: salt,
      parallelism,
      tagLength: expected.length,
      memory,
      passes,
    }),
  );
  return timingSafeEqual(actual, expected);
}

export function childLockDuration(attempts: number) {
  if (attempts < 5) return 0;
  if (attempts === 5) return 5 * 60_000;
  if (attempts === 6) return 15 * 60_000;
  return 60 * 60_000;
}
