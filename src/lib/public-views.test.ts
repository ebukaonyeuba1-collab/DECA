import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVATE_BASE_TABLES } from "./public-views";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) && !/\.test\.ts$/.test(p) ? [p] : [];
  });
}
const root = path.resolve(__dirname, "..");

describe("discovery code never reads private base tables", () => {
  const pattern = new RegExp(`\\.from\\(\\s*["'\`](${PRIVATE_BASE_TABLES.join("|")})["'\`]`);
  it("public routes, shared components and shared libs contain no base-table queries", () => {
    const offenders = [...files(path.join(root, "app", "(public)")), ...files(path.join(root, "components")), ...files(path.join(root, "lib"))]
      .filter((f) => pattern.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
  it("the service-role client is never imported by pages, layouts or components (only the payment webhook)", () => {
    const offenders = [...files(path.join(root, "app")), ...files(path.join(root, "components"))]
      .filter((f) => /supabase\/service/.test(readFileSync(f, "utf8")) && !f.includes(`${path.sep}api${path.sep}webhooks${path.sep}`))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
  it("no file in src reads the service-role key except the env loader and the server-only service client", () => {
    const offenders = files(root).filter((f) => /SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f).split(path.sep).join("/")).filter((f) => !["lib/env-server.ts", "lib/supabase/service.ts"].includes(f));
    expect(offenders).toEqual([]);
  });
  it("no client component imports server-only modules, the server client or the service client", () => {
    const offenders = files(root).filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")) && /server-only|supabase\/service|supabase\/server/.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
