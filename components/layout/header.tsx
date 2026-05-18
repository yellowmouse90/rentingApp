import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Wrench, Plus, MessageSquare } from "lucide-react"
import { MobileMenu } from "./mobile-menu"
import { UserMenu } from "./user-menu"
import { LanguageSwitcher } from "./language-switcher"

export async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
    profile = data
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Wrench className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">ToolShare</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/listings"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Esplora
          </Link>
          <Link
            href="/categories"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Categorie
          </Link>
          <Link
            href="/how-it-works"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Come funziona
          </Link>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link
                href="/listings/new"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
              >
                <Plus className="h-4 w-4" />
                Pubblica annuncio
              </Link>
              <Link
                href="/messages"
                className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MessageSquare className="h-5 w-5" />
              </Link>
              <UserMenu user={user} profile={profile} />
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Accedi
              </Link>
              <Link
                href="/auth/sign-up"
                className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Registrati
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <MobileMenu user={user} profile={profile} />
      </div>
    </header>
  )
}
