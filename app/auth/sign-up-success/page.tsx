import Link from "next/link"
import { Mail, CheckCircle } from "lucide-react"
import { getServerI18n } from "@/lib/i18n/server"

export default async function SignUpSuccessPage() {
  const { t } = await getServerI18n()
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/20">
            <CheckCircle className="h-8 w-8 text-accent" />
          </div>

          <h1 className="text-2xl font-bold text-foreground">{t("signup_success.title")}</h1>

          <p className="mt-4 text-muted-foreground">
            {t("signup_success.description")}
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-muted p-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("signup_success.expires")}
            </span>
          </div>

          <div className="mt-8">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-primary hover:underline"
            >
              {t("signup_success.back_to_login")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

