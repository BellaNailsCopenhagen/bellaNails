import type { Metadata } from "next"

import { AdminComingSoon } from "@/components/admin/admin-coming-soon"

export const metadata: Metadata = { title: "New booking" }

export default function AdminNewPage() {
  return <AdminComingSoon section="New booking" />
}
