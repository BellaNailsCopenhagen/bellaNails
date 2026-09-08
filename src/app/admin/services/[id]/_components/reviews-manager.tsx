"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Eyebrow, BodySm } from "@/components/ui/typography"
import { addReview, deleteReview } from "@/modules/catalog/review-actions"
import type { Review } from "@/modules/catalog"
import { FieldLabel, fieldLabel } from "@/components/admin/field-label"

/** Owner manager for a service's client reviews ("what clients say"). */
export function ReviewsManager({
  serviceId,
  reviews,
}: {
  serviceId: string
  reviews: Review[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [authorName, setAuthorName] = useState("")
  const [body, setBody] = useState("")
  const [rating, setRating] = useState("")

  const add = () =>
    startTransition(async () => {
      const result = await addReview(serviceId, {
        authorName,
        body,
        rating: rating ? Number(rating) : null,
      })
      if (!result.ok) {
        toast.error(result.error || "Couldn’t save.")
        return
      }
      toast.success("Review added")
      setAuthorName("")
      setBody("")
      setRating("")
      router.refresh()
    })

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteReview(id)
      if (!result.ok) toast.error(result.error || "Couldn’t remove.")
      else router.refresh()
    })

  return (
    <section className="space-y-3 pl-2">
      <Eyebrow as="h3">Reviews</Eyebrow>

      {reviews.length ? (
        <ul className="space-y-2">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex items-start justify-between gap-3 rounded-sm border border-border p-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="font-functional text-sm text-foreground">
                  “{review.body}”
                </p>
                <p className="font-functional text-xs text-muted-foreground">
                  {review.authorName ?? "Anonymous"}
                  {review.rating ? ` · ${review.rating}/5` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(review.id)}
                className="shrink-0 font-functional text-[0.625rem] uppercase tracking-widest-lux text-destructive/70 transition-colors hover:text-destructive"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <BodySm className="text-xs">No reviews yet.</BodySm>
      )}

      <div className="space-y-3 rounded-sm border border-dashed border-border p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="review-author" className={fieldLabel}>
              Name (optional)
            </Label>
            <Input
              id="review-author"
              value={authorName}
              onValueChange={setAuthorName}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-rating" className={fieldLabel}>
              Rating
            </Label>
            <select
              id="review-rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="w-full border-b border-border bg-transparent px-0 py-2 font-functional text-sm text-foreground outline-none focus-visible:border-foreground"
            >
              <option value="">No rating</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <FieldLabel htmlFor="review-body" required>
            Review
          </FieldLabel>
          <Textarea
            id="review-body"
            aria-required="true"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-20"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={pending || !body.trim()} onClick={add}>
            {pending ? "Saving…" : "Add review"}
          </Button>
        </div>
      </div>
    </section>
  )
}
