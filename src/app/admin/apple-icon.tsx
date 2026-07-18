import { renderAppIcon } from "@/lib/admin/app-icon"

// iOS home-screen icon, scoped to /admin (not the app root) so only the admin
// advertises it — the client site keeps its own identity. Apple rounds the
// corners itself, so this renders full-bleed.
export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return renderAppIcon(size.width)
}
