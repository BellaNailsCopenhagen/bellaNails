"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateCategoryOrder } from "@/modules/catalog/category-actions"

export function useCategoryReorder<T extends { id: string }>(initialCategories: T[]) {
  const router = useRouter()
  const [categories, setCategories] = useState<T[]>(initialCategories)

  const pendingOrderRef = useRef<string[]>(initialCategories.map((c) => c.id))
  const hasUnsavedChanges = useRef(false)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hasUnsavedChanges.current) {
      setCategories(initialCategories)
      pendingOrderRef.current = initialCategories.map((c) => c.id)
    }
  }, [initialCategories])

  const flushSave = useCallback(
    async (ids: string[]) => {
      if (!hasUnsavedChanges.current) {
        return
      }

      hasUnsavedChanges.current = false

      try {
        const res = await updateCategoryOrder(ids)
        if (!res.ok) {
          toast.error(res.error || "Couldn't save reordering.")
          setCategories(initialCategories)
          pendingOrderRef.current = initialCategories.map((c) => c.id)
        } else {
          router.refresh()
        }
      } catch {
        toast.error("Couldn't save reordering.")
        setCategories(initialCategories)
        pendingOrderRef.current = initialCategories.map((c) => c.id)
      }
    },
    [initialCategories, router],
  )

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      if (hasUnsavedChanges.current) {
        updateCategoryOrder(pendingOrderRef.current).catch(() => {})
      }
    }
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges.current) {
        e.preventDefault()
        e.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  const handleMove = (categoryId: string, direction: "up" | "down") => {
    const ids = categories.map((c) => c.id)
    const from = ids.indexOf(categoryId)

    if (from === -1) {
      return
    }

    const to = direction === "up" ? from - 1 : from + 1
    if (to < 0 || to >= ids.length) {
      return
    }

    const updated = [...categories]
    ;[updated[from], updated[to]] = [updated[to], updated[from]]

    setCategories(updated)

    const newIds = updated.map((c) => c.id)
    pendingOrderRef.current = newIds
    hasUnsavedChanges.current = true

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      flushSave(newIds)
    }, 800)
  }

  return {
    categories,
    handleMove,
  }
}
