import type { Metadata } from "next"

import { AdminComingSoon } from "@/components/admin/admin-coming-soon"

export const metadata: Metadata = { title: "More" }

export default function AdminMorePage() {
  return <AdminComingSoon section="More" />
}
