import { createDb, type Model } from "../mod.ts"

export interface Person extends Model {
  name: string
  age: number
  friends: string[]
  address: {
    country: string
    city: string | null
    postcode?: number
  }
}

export const testPerson: Person = {
  name: "Oliver",
  age: 24,
  friends: ["Elias", "Anders"],
  address: {
    country: "Norway",
    city: "Bergen",
    postcode: 420,
  },
}

export const testPerson2: Person = {
  name: "Anders",
  age: 24,
  friends: ["Oliver", "Elias"],
  address: {
    country: "Norway",
    city: "Oslo",
    postcode: 1024,
  },
}

const kv = await Deno.openKv()

export const db = createDb(kv, {
  people: (cb) => cb.collection<Person>().build(),
  indexablePeople: (cb) =>
    cb.indexableCollection<Person>().build({
      indices: {
        name: "primary",
        age: "secondary",
      },
    }),
  values: {
    numbers: (cb) => cb.collection<number>().build(),
    strings: (cb) => cb.collection<string>().build(),
    u64s: (cb) => cb.collection<Deno.KvU64>().build(),
  },
  arrs: (cb) => cb.collection<string[]>().build(),
  dates: (cb) => cb.collection<Date>().build(),
})

export async function reset() {
  await db.people.deleteMany()
  await db.indexablePeople.deleteMany()
  await db.values.numbers.deleteMany()
  await db.values.strings.deleteMany()
  await db.values.u64s.deleteMany()
  await db.arrs.deleteMany()
  await db.dates.deleteMany()
}
