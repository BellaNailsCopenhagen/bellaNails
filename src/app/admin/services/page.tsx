import type { Metadata } from "next"

import { AdminComingSoon } from "@/components/admin/admin-coming-soon"

export const metadata: Metadata = { title: "Services" }

export default function AdminServicesPage() {
  return <AdminComingSoon section="Services" />
}
