"use client"

import Link from "next/link"
import { useLanguage } from "@/lib/i18n/language-context"
import { Search, Calendar, Handshake, Heart, Shield, DollarSign, ArrowRight } from "lucide-react"

export default function HowItWorksPage() {
  const { t } = useLanguage()

  const steps = [
    {
      icon: Search,
      title: t("how_it_works.steps.search.title"),
      description: t("how_it_works.steps.search.description"),
      details: [
        t("how_it_works.steps.search.detail1"),
        t("how_it_works.steps.search.detail2"),
        t("how_it_works.steps.search.detail3"),
      ],
    },
    {
      icon: Calendar,
      title: t("how_it_works.steps.book.title"),
      description: t("how_it_works.steps.book.description"),
      details: [
        t("how_it_works.steps.book.detail1"),
        t("how_it_works.steps.book.detail2"),
        t("how_it_works.steps.book.detail3"),
      ],
    },
    {
      icon: Handshake,
      title: t("how_it_works.steps.rent.title"),
      description: t("how_it_works.steps.rent.description"),
      details: [
        t("how_it_works.steps.rent.detail1"),
        t("how_it_works.steps.rent.detail2"),
        t("how_it_works.steps.rent.detail3"),
      ],
    },
  ]

  const benefits = [
    {
      icon: DollarSign,
      title: t("how_it_works.benefits.save_money.title"),
      description: t("how_it_works.benefits.save_money.description"),
    },
    {
      icon: Shield,
      title: t("how_it_works.benefits.secure.title"),
      description: t("how_it_works.benefits.secure.description"),
    },
    {
      icon: Heart,
      title: t("how_it_works.benefits.sustainable.title"),
      description: t("how_it_works.benefits.sustainable.description"),
    },
  ]

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 to-primary/5 py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              {t("how_it_works.title")}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {t("how_it_works.subtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* Main Steps Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t("how_it_works.main_steps.title")}
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => {
              const IconComponent = step.icon
              return (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-card p-8 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <IconComponent className="h-8 w-8" />
                    </div>
                    <div className="text-4xl font-bold text-primary/20">{index + 1}</div>
                  </div>

                  <h3 className="text-xl font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground mb-6">{step.description}</p>

                  <ul className="space-y-3">
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-primary/60 flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t("how_it_works.benefits.title")}
            </h2>
            <p className="mt-4 text-muted-foreground">
              {t("how_it_works.benefits.subtitle")}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {benefits.map((benefit, index) => {
              const IconComponent = benefit.icon
              return (
                <div
                  key={index}
                  className="rounded-lg bg-background p-8 shadow-sm text-center"
                >
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Safety & Trust Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t("how_it_works.safety.title")}
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: t("how_it_works.safety.secure_payments.title"),
                description: t("how_it_works.safety.secure_payments.description"),
              },
              {
                title: t("how_it_works.safety.verified_users.title"),
                description: t("how_it_works.safety.verified_users.description"),
              },
              {
                title: t("how_it_works.safety.deposit_protection.title"),
                description: t("how_it_works.safety.deposit_protection.description"),
              },
              {
                title: t("how_it_works.safety.reviews.title"),
                description: t("how_it_works.safety.reviews.description"),
              },
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <Shield className="mx-auto mb-4 h-8 w-8 text-primary" />
                <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              {t("how_it_works.faq.title")}
            </h2>
          </div>

          <div className="space-y-6">
            {[
              {
                question: t("how_it_works.faq.question1"),
                answer: t("how_it_works.faq.answer1"),
              },
              {
                question: t("how_it_works.faq.question2"),
                answer: t("how_it_works.faq.answer2"),
              },
              {
                question: t("how_it_works.faq.question3"),
                answer: t("how_it_works.faq.answer3"),
              },
              {
                question: t("how_it_works.faq.question4"),
                answer: t("how_it_works.faq.answer4"),
              },
            ].map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-background p-6"
              >
                <h3 className="font-semibold text-foreground mb-2">{item.question}</h3>
                <p className="text-muted-foreground text-sm">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl mb-4">
            {t("how_it_works.cta.title")}
          </h2>
          <p className="text-muted-foreground mb-8">
            {t("how_it_works.cta.subtitle")}
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/listings"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("how_it_works.cta.browse_button")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/listings/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-transparent px-6 py-3 font-medium text-primary transition-colors hover:bg-primary/10"
            >
              {t("how_it_works.cta.publish_button")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

