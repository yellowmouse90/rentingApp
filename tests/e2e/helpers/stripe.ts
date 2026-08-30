import Stripe from "stripe"

export function getTestStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY missing - is .env.test loaded (see playwright.config.ts)?")
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Creates a throwaway Stripe Connect (custom, IT) test account and polls until it can actually
// receive transfers - `charges_enabled`/`payouts_enabled` don't flip synchronously with account
// creation even in test mode (observed delay: a few seconds, occasionally longer), they clear
// once the account has satisfied its requirements (here: an external bank account).
export async function createTestConnectAccount(stripe: Stripe): Promise<string> {
  const email = `test-owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`

  const account = await stripe.accounts.create({
    type: "custom",
    country: "IT",
    email,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    business_type: "individual",
    individual: {
      first_name: "Mario",
      last_name: "Rossi",
      email,
      dob: { day: 1, month: 1, year: 1901 },
      // "address_full_match" is Stripe's documented test-mode magic value for a guaranteed
      // identity-verification pass - without it, this simulated check fails nondeterministically
      // (observed: 1901-01-01/DOB and unremarkable fake data succeeded on some runs, failed on
      // others with "verification_failed_keyed_identity" on identical input).
      address: { line1: "address_full_match", city: "Roma", postal_code: "00100", country: "IT" },
      phone: "+390612345678",
    },
    business_profile: {
      mcc: "7394",
      product_description: "Test fixture account for automated tests",
    },
    tos_acceptance: {
      date: Math.floor(Date.now() / 1000),
      ip: "8.8.8.8",
    },
  })

  // Stripe's documented test IBAN for Italy - always accepted, never a real account.
  await stripe.accounts.createExternalAccount(account.id, {
    external_account: {
      object: "bank_account",
      country: "IT",
      currency: "eur",
      account_number: "IT60X0542811101000000123456",
    },
  })

  for (let attempt = 0; attempt < 40; attempt++) {
    const refreshed = await stripe.accounts.retrieve(account.id)
    if (refreshed.charges_enabled && refreshed.payouts_enabled) {
      return account.id
    }
    await sleep(4000)
  }

  throw new Error(`Connect test account ${account.id} did not become enabled in time`)
}

export async function deleteTestConnectAccount(stripe: Stripe, accountId: string) {
  await stripe.accounts.del(accountId).catch(() => {})
}
