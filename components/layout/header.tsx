import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Wrench } from "lucide-react"
import { MobileMenu } from "./mobile-menu"
import { HeaderNav } from "./header-nav"
import { HeaderActions } from "./header-actions"

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
        <HeaderNav />

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <HeaderActions user={user} profile={profile} />
        </div>

        {/* Mobile Menu */}
        <MobileMenu user={user} profile={profile} />
      </div>
    </header>
  )
}
