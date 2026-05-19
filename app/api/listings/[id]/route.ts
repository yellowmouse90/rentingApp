import { NextResponse } from "next/server"
import { requireApiUser } from "@/lib/auth/api"
import { getServerI18n } from "@/lib/i18n/server"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const { t } = await getServerI18n()
    const { id } = await params
    const { supabase, user } = await requireApiUser()

    if (!user) {
      return NextResponse.json({ error: t("api.common.unauthorized") }, { status: 401 })
    }

    const { data: listing, error: listingError } = await supabase
      .schema("inventory_domain")
      .from("listings")
      .select("id, owner_id, is_active")
      .eq("id", id)
      .single()

    if (listingError || !listing) {
      return NextResponse.json({ error: t("api.listings.not_found") }, { status: 404 })
    }

    if (listing.owner_id !== user.id) {
      return NextResponse.json({ error: t("api.listings.forbidden") }, { status: 403 })
    }

    if (!listing.is_active) {
      return NextResponse.json({ success: true })
    }

    const { error: updateError } = await supabase
      .schema("inventory_domain")
      .from("listings")
      .update({
        is_active: false,
        is_available: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("owner_id", user.id)

    if (updateError) {
      console.error("Delete listing error:", updateError)
      return NextResponse.json({ error: t("api.listings.delete_error") }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/listings/[id] error:", error)
    const { t } = await getServerI18n()
    return NextResponse.json({ error: t("api.common.internal_error") }, { status: 500 })
  }
}
