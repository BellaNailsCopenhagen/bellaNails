import type { Metadata } from "next"

import { AdminComingSoon } from "@/components/admin/admin-coming-soon"

export const metadata: Metadata = { title: "Clients" }

export default function AdminClientsPage() {
  return <AdminComingSoon section="Clients" />
}
