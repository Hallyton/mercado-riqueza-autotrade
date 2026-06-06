import type { Metadata } from "next";
import { AutotradeLandingPage } from "@/components/marketing/autotrade-landing";
import {
  AUTOTRADE_LANDING_METADATA,
  AUTOTRADE_LANDING_OG_IMAGE,
  AUTOTRADE_LANDING_PATH,
} from "@/lib/commercial/autotrade-landing";

const siteUrl =
  process.env.AUTH_URL?.replace(/\/$/, "") ??
  "https://autotrade-staging.mercadodariqueza.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: AUTOTRADE_LANDING_METADATA.title,
  description: AUTOTRADE_LANDING_METADATA.description,
  alternates: {
    canonical: AUTOTRADE_LANDING_PATH,
  },
  openGraph: {
    title: AUTOTRADE_LANDING_METADATA.title,
    description: AUTOTRADE_LANDING_METADATA.description,
    type: "website",
    locale: "pt_BR",
    url: AUTOTRADE_LANDING_PATH,
    siteName: "Mercado da Riqueza AutoTrade",
    images: [
      {
        url: AUTOTRADE_LANDING_OG_IMAGE,
        width: 512,
        height: 512,
        alt: "Mercado da Riqueza — logo oficial",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: AUTOTRADE_LANDING_METADATA.title,
    description: AUTOTRADE_LANDING_METADATA.description,
    images: [AUTOTRADE_LANDING_OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export default function AutotradePublicLandingPage() {
  return <AutotradeLandingPage />;
}
