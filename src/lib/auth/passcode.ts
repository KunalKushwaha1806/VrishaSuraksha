import bcrypt from "bcryptjs";
import { env } from "../env";

/** Passcodes and invite codes are only ever stored as bcrypt hashes. */
export function hashPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(passcode, env().BCRYPT_COST);
}

export function verifyPasscode(passcode: string, hash: string): Promise<boolean> {
  return bcrypt.compare(passcode, hash);
}
