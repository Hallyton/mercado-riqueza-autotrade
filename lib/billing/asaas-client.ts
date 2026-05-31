import {
  assertAsaasChargeAllowed,
  getAsaasApiKey,
  getAsaasBaseUrl,
} from "@/lib/billing/asaas-config";
import type {
  AsaasApiErrorBody,
  AsaasCustomerResponse,
  AsaasPaymentResponse,
  AsaasPixQrCodeResponse,
} from "@/lib/billing/asaas-types";
import { redactAsaasPayload } from "@/lib/billing/asaas-redact";

export class AsaasClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly providerCode?: string
  ) {
    super(message);
    this.name = "AsaasClientError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as AsaasApiErrorBody;
    const first = body.errors?.[0];
    if (first?.description) return first.description;
    if (first?.code) return first.code;
  } catch {
    // ignore
  }
  return `HTTP ${res.status}`;
}

export async function asaasRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  assertAsaasChargeAllowed();

  const apiKey = getAsaasApiKey();
  if (!apiKey) {
    throw new AsaasClientError("Asaas não configurado.", "ASAAS_NOT_CONFIGURED", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const res = await fetch(`${getAsaasBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (!res.ok) {
      const message = await parseErrorResponse(res);
      throw new AsaasClientError(message, "ASAAS_API_ERROR", res.status);
    }

    if (res.status === 204) {
      return {} as T;
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof AsaasClientError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AsaasClientError("Timeout na API Asaas.", "ASAAS_TIMEOUT", 504);
    }
    throw new AsaasClientError(
      error instanceof Error ? error.message : "Falha na API Asaas.",
      "ASAAS_REQUEST_FAILED",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function createAsaasCustomer(input: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string | null;
  externalReference: string;
}) {
  const payload = {
    name: input.name,
    email: input.email,
    cpfCnpj: input.cpfCnpj,
    mobilePhone: input.mobilePhone ?? undefined,
    externalReference: input.externalReference,
  };

  return asaasRequest<AsaasCustomerResponse>("/customers", {
    method: "POST",
    body: payload,
  });
}

export async function getAsaasCustomer(customerId: string) {
  return asaasRequest<AsaasCustomerResponse>(`/customers/${customerId}`);
}

export async function createAsaasPixPayment(input: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}) {
  const payload = {
    customer: input.customerId,
    billingType: "PIX",
    value: input.value,
    dueDate: input.dueDate,
    description: input.description,
    externalReference: input.externalReference,
  };

  return asaasRequest<AsaasPaymentResponse>("/payments", {
    method: "POST",
    body: payload,
  });
}

export async function getAsaasPayment(paymentId: string) {
  return asaasRequest<AsaasPaymentResponse>(`/payments/${paymentId}`);
}

export async function cancelAsaasPayment(paymentId: string) {
  return asaasRequest<AsaasPaymentResponse>(`/payments/${paymentId}`, {
    method: "DELETE",
  });
}

export async function getAsaasPixQrCode(paymentId: string) {
  return asaasRequest<AsaasPixQrCodeResponse>(`/payments/${paymentId}/pixQrCode`);
}

export function safeAsaasLogContext(payload: unknown) {
  return redactAsaasPayload(payload);
}
