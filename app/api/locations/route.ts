import { NextResponse } from "next/server";
import { z } from "zod";
import { listLocations } from "@/server/discovery/queries";

/** Public reference data: children of a location (or all states when no parent). */
export async function GET(request: Request) {
  const parent = new URL(request.url).searchParams.get("parent");
  if (parent !== null && !z.string().uuid().safeParse(parent).success) return NextResponse.json({ error: "invalid parent" }, { status: 400 });
  try {
    return NextResponse.json({ locations: await listLocations(parent) }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "locations unavailable" }, { status: 503 });
  }
}
