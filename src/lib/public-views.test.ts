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
  it("UI routes, components and shared libs contain no base-table queries (except session helpers acting on the user's own profile)", () => {
    const offenders = [...files(path.join(root, "app")), ...files(path.join(root, "components")), ...files(path.join(root, "lib"))]
      .filter((f) => pattern.test(readFileSync(f, "utf8"))).map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
  it("service-role client is only imported by server code", () => {
    const offenders = [...files(path.join(root, "app")), ...files(path.join(root, "components"))]
      .filter((f) => /supabase\/service/.test(readFileSync(f, "utf8")) && !f.includes(`${path.sep}api${path.sep}`))
      .map((f) => path.relative(root, f));
    expect(offenders).toEqual([]);
  });
});
