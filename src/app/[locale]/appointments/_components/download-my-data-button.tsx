"use client"

import { Button } from "@/components/ui/button"
import { useActionRunner } from "@/hooks/use-action-runner"
import { requestMyDataExport } from "@/modules/clients/data-export-actions"

/**
 * Self-service data export (GDPR access/portability). Fetches the JSON from the
 * server action and hands it to the browser as a download — no file is stored.
 */
export function DownloadMyDataButton() {
  const { pending, run } = useActionRunner()

  const onClick = () =>
    run(async () => {
      const res = await requestMyDataExport()
      if (res.ok) {
        const blob = new Blob([res.json], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = res.filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
      return res
    })

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {pending ? "Preparing…" : "Download my data"}
    </Button>
  )
}
