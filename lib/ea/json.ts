import { NextResponse } from "next/server";

export function eaJson<T>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
