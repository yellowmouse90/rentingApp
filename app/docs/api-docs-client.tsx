"use client"

import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false })

export function ApiDocsClient() {
  // Disable the built-in call to validator.swagger.io - there is no reason to send the shape of
  // an internal API to a third-party service, and it renders as a distracting "N Issues" badge.
  // @types/swagger-ui-react doesn't declare this prop even though swagger-ui-react itself accepts
  // it at runtime, hence the cast.
  return <SwaggerUI url="/api/docs" {...({ validatorUrl: null } as object)} />
}
