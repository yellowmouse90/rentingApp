import Link from "next/link"
import { requirePageUser } from "@/lib/auth/page"
import { getServerI18n } from "@/lib/i18n/server"
import { StripeConnectCard } from "@/components/dashboard/stripe-connect-card"
import { Shield, CreditCard, CheckCircle, ArrowRight } from "lucide-react"

export default async function PaymentsPage() {
  const { t } = await getServerI18n()
  const { supabase, user } = await requirePageUser("/dashboard/payments")

  const { data: profile } = await supabase
    .from("user_domain.profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", user.id)
    .single()

  return (
    <main className="min-h-screen bg-muted/30 py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr] lg:items-start">
            <div>
              <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
                {t("dashboard.payments.title")}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
                {t("dashboard.payments.subtitle")}
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Shield,
                    title: t("dashboard.payments.benefit1"),
                  },
                  {
                    icon: CreditCard,
                    title: t("dashboard.payments.benefit2"),
                  },
                  {
                    icon: CheckCircle,
                    title: t("dashboard.payments.benefit3"),
                  },
                ].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div key={index} className="rounded-3xl border border-border bg-background p-5 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-6 w-6" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-foreground">{item.title}</p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-10 rounded-3xl border border-border bg-muted/50 p-6">
                <h2 className="text-xl font-semibold text-foreground">{t("dashboard.payments.how_it_works_title")}</h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("dashboard.payments.how_it_works_description")}
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">{t("dashboard.payments.how_it_works_step1")}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">{t("dashboard.payments.how_it_works_step2")}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm text-muted-foreground">{t("dashboard.payments.how_it_works_step3")}</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:border-primary/50"
                >
                  {t("dashboard.payments.back_to_dashboard")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div>
              <StripeConnectCard
                hasAccount={!!profile?.stripe_account_id}
                onboardingComplete={profile?.stripe_onboarding_complete || false}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

