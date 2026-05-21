import { NextResponse } from "next/server";

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance?: string;
};

export function problemJson(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance?: string
) {
  const body: ProblemDetails = {
    type: "https://mercadodariqueza.com.br/errors/" + code.toLowerCase(),
    title,
    status,
    code,
    detail,
    instance,
  };
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}
