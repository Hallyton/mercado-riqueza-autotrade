import { hash } from "bcryptjs";
import {
  PrismaClient,
  UserRole,
  type Plan,
  type ExposureProfile,
} from "@prisma/client";

const prisma = new PrismaClient();

const EXPOSURE_PROFILES = [
  {
    slug: "conservador",
    name: "Conservador",
    description:
      "Menor exposição ao mercado. Indicado para quem prioriza preservação de capital dentro do perfil contratado.",
    sortOrder: 1,
  },
  {
    slug: "moderado",
    name: "Moderado",
    description:
      "Exposição intermediária. Equilíbrio entre participação no mercado e limites do plano.",
    sortOrder: 2,
  },
  {
    slug: "agressivo",
    name: "Agressivo",
    description:
      "Maior exposição permitida pelo plano. Exige tolerância a volatilidade e drawdown.",
    sortOrder: 3,
  },
] as const;

const PLANS = [
  {
    slug: "start",
    name: "Start",
    description: "Entrada no AutoTrade — 1 conta MT5, perfil conservador.",
    maxMt5Accounts: 1,
    maxDevices: 1,
    allowDemo: false,
    sortOrder: 1,
    priceMonthlyCents: 9900,
    profileSlugs: ["conservador"] as const,
    features: [
      { key: "support_channel", value: "email" },
      { key: "priority", value: "standard" },
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Operação ampliada — até 2 contas, perfis conservador e moderado.",
    maxMt5Accounts: 2,
    maxDevices: 2,
    allowDemo: false,
    sortOrder: 2,
    priceMonthlyCents: 19900,
    profileSlugs: ["conservador", "moderado"] as const,
    features: [
      { key: "support_channel", value: "chat" },
      { key: "priority", value: "standard" },
    ],
  },
  {
    slug: "black",
    name: "Black",
    description: "Máximo do produto — até 3 contas, todos os perfis de exposição.",
    maxMt5Accounts: 3,
    maxDevices: 2,
    allowDemo: false,
    sortOrder: 3,
    priceMonthlyCents: 39900,
    profileSlugs: ["conservador", "moderado", "agressivo"] as const,
    features: [
      { key: "support_channel", value: "priority" },
      { key: "priority", value: "high" },
    ],
  },
] as const;

async function seedExposureProfiles(): Promise<Map<string, ExposureProfile>> {
  const map = new Map<string, ExposureProfile>();

  for (const profile of EXPOSURE_PROFILES) {
    const row = await prisma.exposureProfile.upsert({
      where: { slug: profile.slug },
      create: profile,
      update: {
        name: profile.name,
        description: profile.description,
        sortOrder: profile.sortOrder,
        isActive: true,
      },
    });
    map.set(profile.slug, row);
  }

  return map;
}

async function seedPlans(
  profilesBySlug: Map<string, ExposureProfile>
): Promise<Plan[]> {
  const plans: Plan[] = [];

  for (const planDef of PLANS) {
    const plan = await prisma.plan.upsert({
      where: { slug: planDef.slug },
      create: {
        slug: planDef.slug,
        name: planDef.name,
        description: planDef.description,
        maxMt5Accounts: planDef.maxMt5Accounts,
        maxDevices: planDef.maxDevices,
        allowDemo: planDef.allowDemo,
        sortOrder: planDef.sortOrder,
        isActive: true,
      },
      update: {
        name: planDef.name,
        description: planDef.description,
        maxMt5Accounts: planDef.maxMt5Accounts,
        maxDevices: planDef.maxDevices,
        allowDemo: planDef.allowDemo,
        sortOrder: planDef.sortOrder,
        isActive: true,
      },
    });

    await prisma.planPrice.deleteMany({
      where: { planId: plan.id, interval: "month" },
    });
    await prisma.planPrice.create({
      data: {
        planId: plan.id,
        currency: "BRL",
        amountCents: planDef.priceMonthlyCents,
        interval: "month",
        intervalCount: 1,
        isActive: true,
      },
    });

    for (const feature of planDef.features) {
      await prisma.planFeature.upsert({
        where: {
          planId_key: { planId: plan.id, key: feature.key },
        },
        create: {
          planId: plan.id,
          key: feature.key,
          value: feature.value,
        },
        update: { value: feature.value },
      });
    }

    for (const profileSlug of planDef.profileSlugs) {
      const profile = profilesBySlug.get(profileSlug);
      if (!profile) {
        throw new Error(`Perfil não encontrado: ${profileSlug}`);
      }
      await prisma.planExposureProfile.upsert({
        where: {
          planId_exposureProfileId: {
            planId: plan.id,
            exposureProfileId: profile.id,
          },
        },
        create: {
          planId: plan.id,
          exposureProfileId: profile.id,
        },
        update: {},
      });
    }

    plans.push(plan);
  }

  return plans;
}

async function seedAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() ?? "Administrador";

  if (!email || !password) {
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente antes de executar o seed."
    );
  }

  if (password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD deve ter no mínimo 12 caracteres em ambientes de seed."
    );
  }

  const passwordHash = await hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      role: UserRole.SUPERADMIN,
      emailVerified: new Date(),
    },
    update: {
      name,
      passwordHash,
      role: UserRole.SUPERADMIN,
    },
  });

  console.log(`Admin inicial: ${email} (${UserRole.SUPERADMIN})`);
}

async function seedIbovBenchmark(): Promise<void> {
  const base = 125000;
  let price = base;
  const today = new Date();
  for (let i = 60; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    price *= 1 + (Math.random() - 0.48) * 0.012;
    const dailyReturn = i === 60 ? 0 : (price - base) / base;
    await prisma.benchmarkIbovDaily.upsert({
      where: { tradeDate: day },
      create: {
        tradeDate: day,
        closeValue: Math.round(price * 100) / 100,
        dailyReturn,
      },
      update: {
        closeValue: Math.round(price * 100) / 100,
        dailyReturn,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log("Seed Mercado da Riqueza AutoTrade…");

  const profilesBySlug = await seedExposureProfiles();
  const plans = await seedPlans(profilesBySlug);
  await seedIbovBenchmark();
  await seedAdminUser();

  console.log(
    `Perfis de exposição: ${profilesBySlug.size} | Planos: ${plans.map((p) => p.slug).join(", ")}`
  );
  console.log(
    "Sem dados de estratégia (vault) — conforme modelo caixa preta."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
