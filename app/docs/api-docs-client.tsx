"use client"

import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false })

export function ApiDocsClient() {
  // Disable the built-in call to validator.swagger.io - there is no reason to send the shape of
  // an internal API to a third-party service, and it renders as a distracting "N Issues" badge.
  return <SwaggerUI url="/api/docs" validatorUrl={null} />
}
