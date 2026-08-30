// Brings up the local Supabase stack (Docker) with a clean copy of db/migrations/*.sql applied.
//
// db/migrations/ is the single source of truth for schema (see CLAUDE.md). supabase/migrations/
// is git-ignored and only exists so the Supabase CLI's own start/reset machinery (which needs
// our custom schemas to exist before PostgREST's health check passes) can apply them - this
// script copies db/migrations/*.sql there on every run rather than duplicating them by hand.
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dirname, "..")
const sourceDir = join(root, "db", "migrations")
const targetDir = join(root, "supabase", "migrations")

function run(args) {
  console.log(`$ npx supabase ${args.join(" ")}`)
  // shell:true is needed to resolve `npx` across platforms (it's a .cmd shim on Windows); all
  // args here are static, not user input, so the escaping caveat that comes with shell:true doesn't apply.
  execFileSync("npx", ["supabase", ...args], { cwd: root, stdio: "inherit", shell: true })
}

rmSync(targetDir, { recursive: true, force: true })
mkdirSync(targetDir, { recursive: true })
const files = readdirSync(sourceDir).filter((f) => f.endsWith(".sql"))
for (const file of files) {
  cpSync(join(sourceDir, file), join(targetDir, file))
}
console.log(`Copied ${files.length} migration file(s) from db/migrations/ to supabase/migrations/.`)

run(["start"])
run(["db", "reset", "--local", "--no-seed"])

console.log("Local test DB ready.")
