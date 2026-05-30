import prisma from "@/lib/prisma";
import {
  MAGIC_NUMBER_MAX,
  MAGIC_NUMBER_MIN,
} from "./constants";

export class MagicNumberError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "MagicNumberError";
  }
}

async function collectUsedMagicNumbers(): Promise<Set<number>> {
  const used = new Set<number>();

  const [instances, licenses] = await Promise.all([
    prisma.robotInstance.findMany({
      where: { magicNumber: { not: null } },
      select: { magicNumber: true },
    }),
    prisma.license.findMany({
      where: { expectedMagicNumber: { not: null } },
      select: { expectedMagicNumber: true },
    }),
  ]);

  for (const row of instances) {
    if (row.magicNumber != null) used.add(row.magicNumber);
  }
  for (const row of licenses) {
    if (row.expectedMagicNumber != null) used.add(row.expectedMagicNumber);
  }

  return used;
}

export async function allocateMagicNumber(): Promise<number> {
  const used = await collectUsedMagicNumbers();

  for (let n = MAGIC_NUMBER_MIN; n <= MAGIC_NUMBER_MAX; n++) {
    if (!used.has(n)) return n;
  }

  throw new MagicNumberError(
    "Faixa de magicNumber esgotada (910001–910999).",
    "MAGIC_NUMBER_EXHAUSTED"
  );
}

export async function isMagicNumberAvailable(magicNumber: number): Promise<boolean> {
  if (magicNumber < MAGIC_NUMBER_MIN || magicNumber > MAGIC_NUMBER_MAX) {
    return false;
  }

  const [instance, license] = await Promise.all([
    prisma.robotInstance.findFirst({
      where: { magicNumber },
      select: { id: true },
    }),
    prisma.license.findFirst({
      where: { expectedMagicNumber: magicNumber },
      select: { id: true },
    }),
  ]);

  return !instance && !license;
}

export async function assertMagicNumberAvailable(magicNumber: number) {
  const available = await isMagicNumberAvailable(magicNumber);
  if (!available) {
    throw new MagicNumberError(
      `MagicNumber ${magicNumber} já está em uso.`,
      "MAGIC_NUMBER_COLLISION"
    );
  }
}
