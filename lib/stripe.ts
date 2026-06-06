import "server-only"

import Stripe from "stripe"

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Platform fee percentage (10%)
export const PLATFORM_FEE_PERCENT = 10

