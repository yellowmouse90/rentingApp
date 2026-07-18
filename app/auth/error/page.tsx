import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { getServerI18n } from "@/lib/i18n/server"

export default async function AuthErrorPage() {
  const { t } = await getServerI18n()
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">{t("auth_error.title")}</h1>

          <p className="mt-4 text-muted-foreground">
            {t("auth_error.description")}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/auth/sign-up"
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("auth_error.retry_signup")}
            </Link>
            <Link
              href="/auth/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {t("auth_error.back_to_login")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

