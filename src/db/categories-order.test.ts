import assert from "node:assert/strict"
import { test } from "node:test"
import { setCategoryOrder } from "@/db/categories"
import type { Db } from "@/db/client"

test("setCategoryOrder triggers updates for each category id with correct sort order index", async () => {
  const calledUpdates: { id: string; sort_order: number }[] = []

  // Mock Db client interceptor
  const mockDb = {
    from: (table: string) => {
      assert.equal(table, "categories")

      return {
        update: (values: { sort_order: number }) => {
          return {
            eq: (field: string, id: string) => {
              assert.equal(field, "id")
              calledUpdates.push({ id, sort_order: values.sort_order })
              
              return Promise.resolve({ error: null })
            },
          }
        },
      }
    },
  } as unknown as Db

  const orderedIds = ["cat-a", "cat-b", "cat-c"]
  const result = await setCategoryOrder(mockDb, orderedIds)

  assert.equal(result.ok, true)
  assert.equal(calledUpdates.length, 3)
  assert.deepEqual(calledUpdates, [
    { id: "cat-a", sort_order: 0 },
    { id: "cat-b", sort_order: 1 },
    { id: "cat-c", sort_order: 2 },
  ])
})

test("setCategoryOrder handles database update error interception", async () => {
  const mockDb = {
    from: () => ({
      update: () => ({
        eq: () => Promise.resolve({ error: { message: "Database error" } }),
      }),
    }),
  } as unknown as Db

  const orderedIds = ["cat-a", "cat-b"]
  const result = await setCategoryOrder(mockDb, orderedIds)

  assert.equal(result.ok, false)
})
