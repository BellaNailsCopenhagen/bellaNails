import { renderAppIcon } from "@/components/admin/app-icon"

/**
 * Generated PWA icons — the manifest references /icons/icon-192.png,
 * /icons/icon-512.png and /icons/maskable-512.png. Rendered with next/og so
 * we need no SVG→PNG tooling in the build. The `.png` in the URL keeps these
 * outside the i18n proxy matcher (which skips paths with a dot).
 */
const ICONS: Record<string, { size: number; maskable?: boolean }> = {
  "icon-192.png": { size: 192 },
  "icon-512.png": { size: 512 },
  "maskable-512.png": { size: 512, maskable: true },
}

// Only the three known icons exist; anything else 404s.
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }))
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params
  const icon = ICONS[name]
  if (!icon) {
    return new Response("Not found", { status: 404 })
  }

  return renderAppIcon(icon.size, { maskable: icon.maskable })
}
