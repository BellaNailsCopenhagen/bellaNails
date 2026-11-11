import assert from "node:assert/strict"
import { test } from "node:test"

/**
 * Pure reordering logic test for category movement (up/down).
 * Ensures correct index swapping, boundary constraints (top/bottom edge cases),
 * and UI source of truth guarantees.
 */
function moveCategoryInArray<T extends { id: string }>(
  categories: T[],
  categoryId: string,
  direction: "up" | "down",
): T[] {
  const ids = categories.map((c) => c.id)
  const from = ids.indexOf(categoryId)
  if (from === -1) {
    return categories
  }

  const to = direction === "up" ? from - 1 : from + 1
  if (to < 0 || to >= ids.length) {
    return categories // already at edge
  }

  const updated = [...categories]
  ;[updated[from], updated[to]] = [updated[to], updated[from]]

  return updated
}

const initialCategories = [
  { id: "cat-1", name_en: "Nails" },
  { id: "cat-2", name_en: "Lashes" },
  { id: "cat-3", name_en: "Brows" },
]

test("moving a category down swaps it with the next one", () => {
  const result = moveCategoryInArray(initialCategories, "cat-1", "down")
  assert.deepEqual(
    result.map((c) => c.id),
    ["cat-2", "cat-1", "cat-3"],
  )
})

test("moving a category up swaps it with the previous one", () => {
  const result = moveCategoryInArray(initialCategories, "cat-2", "up")
  assert.deepEqual(
    result.map((c) => c.id),
    ["cat-2", "cat-1", "cat-3"],
  )
})

test("moving the top category up stays at the edge", () => {
  const result = moveCategoryInArray(initialCategories, "cat-1", "up")
  assert.deepEqual(
    result.map((c) => c.id),
    ["cat-1", "cat-2", "cat-3"],
  )
})

test("moving the bottom category down stays at the edge", () => {
  const result = moveCategoryInArray(initialCategories, "cat-3", "down")
  assert.deepEqual(
    result.map((c) => c.id),
    ["cat-1", "cat-2", "cat-3"],
  )
})

test("moving a non-existent category returns original array", () => {
  const result = moveCategoryInArray(initialCategories, "cat-999", "up")
  assert.deepEqual(result, initialCategories)
})
