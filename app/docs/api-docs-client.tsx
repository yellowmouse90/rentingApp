"use client"

import dynamic from "next/dynamic"
import type { ComponentProps, ComponentType } from "react"
import type SwaggerUIComponent from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"

// @types/swagger-ui-react doesn't declare `validatorUrl`, even though the underlying
// swagger-ui-react component supports it - widen the props locally instead of `any`.
type SwaggerUIProps = ComponentProps<typeof SwaggerUIComponent> & { validatorUrl?: string | null }

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false }) as ComponentType<SwaggerUIProps>

export function ApiDocsClient() {
  // Disable the built-in call to validator.swagger.io - there is no reason to send the shape of
  // an internal API to a third-party service, and it renders as a distracting "N Issues" badge.
  return <SwaggerUI url="/api/docs" validatorUrl={null} />
}
