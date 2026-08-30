import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createTestAdminClient } from "./helpers/supabase"

// Exercises the real local Postgres + RLS instead of a mocked Supabase client: the homepage
// (app/page.tsx) reads inventory_domain.categories/listings through the anon, RLS-gated client,
// so this is really testing the `listings_select_active` policy (owner-or-active) end to end,
// not just that the component renders.
test.describe("homepage featured listings", () => {
  const suffix = randomUUID().slice(0, 8)
  const categoryName = `Test Category ${suffix}`
  const listingTitle = `Trapano Bosch E2E ${suffix}`
  let userId: string
  let categoryId: string
  let listingId: string

  test.beforeAll(async () => {
    const supabase = createTestAdminClient()

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: `owner-${suffix}@example.com`,
      password: "test-password-123",
      email_confirm: true,
      user_metadata: { display_name: "Mario Rossi Test" },
    })
    if (userError || !userData.user) throw userError
    userId = userData.user.id

    const { data: category, error: categoryError } = await supabase
      .schema("inventory_domain")
      .from("categories")
      .insert({ name: categoryName, slug: `test-category-${suffix}` })
      .select()
      .single()
    if (categoryError || !category) throw categoryError
    categoryId = category.id

    const { data: listing, error: listingError } = await supabase
      .schema("inventory_domain")
      .from("listings")
      .insert({
        owner_id: userId,
        category_id: categoryId,
        title: listingTitle,
        condition: "good",
        price_per_day_cents: 1500,
        is_active: true,
        is_available: true,
      })
      .select()
      .single()
    if (listingError || !listing) throw listingError
    listingId = listing.id
  })

  test.afterAll(async () => {
    const supabase = createTestAdminClient()
    await supabase.schema("inventory_domain").from("listings").delete().eq("id", listingId)
    await supabase.schema("inventory_domain").from("categories").delete().eq("id", categoryId)
    await supabase.auth.admin.deleteUser(userId)
  })

  test("shows an active listing seeded straight into Postgres", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByText(listingTitle)).toBeVisible()
  })
})
