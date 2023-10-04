import { assert } from "../deps.ts"
import { generateUsers, useDb } from "../utils.ts"

Deno.test("collection - deleteMany", async (t) => {
  await t.step("Should delete all documents from the collection", async () => {
    await useDb(async (db) => {
      const users = generateUsers(1_000)
      const crs = await db.users.addMany(users)
      assert(crs.every((cr) => cr.ok))

      const count1 = await db.users.count()
      assert(count1 === users.length)

      await db.users.deleteMany()

      const count2 = await db.users.count()
      assert(count2 === 0)
    })
  })
})