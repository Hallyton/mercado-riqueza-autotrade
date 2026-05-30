/**
 * Uso interno homologação — carrega bearer do mr_at_*.dat sem imprimir token.
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { maskOpaqueToken } from "./resolve-ea-device-from-token";

export function loadBearerFromEaDatFile(login = "52609973"): string | null {
  const override = process.env.STAGING_EA_TOKEN_FILE?.trim();
  const path =
    override ??
    join(
      homedir(),
      "AppData",
      "Roaming",
      "MetaQuotes",
      "Terminal",
      "Common",
      "Files",
      `mr_at_${login}.dat`
    );

  try {
    const buf = readFileSync(path);
    let raw: string;
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      raw = buf.toString("utf16le");
    } else if (buf.includes(0x00)) {
      raw = buf.toString("utf16le");
    } else {
      raw = buf.toString("utf8");
    }
    const line = raw.split(/\r?\n/)[0]?.replace(/\0/g, "").trim();
    if (!line || line.length < 16) return null;
    return line;
  } catch {
    return null;
  }
}

export function resolveBearerToken(): string {
  const preset = process.env.STAGING_EA_BEARER_TOKEN?.trim();
  if (preset) return preset;

  const fromFile = loadBearerFromEaDatFile();
  if (fromFile) {
    console.log(
      `[auth] Bearer carregado de mr_at_*.dat (masked=${maskOpaqueToken(fromFile)})`
    );
    return fromFile;
  }

  throw new Error(
    "Defina STAGING_EA_BEARER_TOKEN ou disponibilize mr_at_<login>.dat no MT5 Common/Files."
  );
}

export function resolveLicenseIdFromEaDatFile(login = "52609973"): string | null {
  const override = process.env.STAGING_EA_TOKEN_FILE?.trim();
  const path =
    override ??
    join(
      homedir(),
      "AppData",
      "Roaming",
      "MetaQuotes",
      "Terminal",
      "Common",
      "Files",
      `mr_at_${login}.dat`
    );
  try {
    const buf = readFileSync(path);
    let raw: string;
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      raw = buf.toString("utf16le");
    } else if (buf.includes(0x00)) {
      raw = buf.toString("utf16le");
    } else {
      raw = buf.toString("utf8");
    }
    const line = raw.split(/\r?\n/)[1]?.replace(/\0/g, "").trim();
    return line || null;
  } catch {
    return null;
  }
}
