# kvdex

Database wrapper for Deno's KV store. Simple and type-safe storing/retrieving of
data.

Support for indexing.

Zero third-party dependencies.

## Table of Contents

- [kvdex](#kvdex)
  - [Table of Contents](#table-of-contents)
  - [Models](#models)
  - [Database](#database)
  - [Collection Methods](#collection-methods)
    - [find()](#find)
    - [findMany()](#findmany)
    - [add()](#add)
    - [addMany()](#addmany)
    - [set()](#set)
    - [update()](#update)
    - [delete()](#delete)
    - [deleteMany()](#deletemany)
    - [getMany()](#getmany)
    - [forEach()](#foreach)
    - [map()](#map)
    - [count()](#count)
  - [Indexable Collection Methods](#indexable-collection-methods)
    - [findByPrimaryIndex()](#findbyprimaryindex)
    - [findBySecondaryIndex()](#findbysecondaryindex)
  - [Database Methods](#database-methods)
    - [countAll()](#countall)
    - [deleteAll()](#deleteall)
    - [atomic()](#atomic)
  - [Atomic Operations](#atomic-operations)
    - [Without checking](#without-checking)
    - [With checking](#with-checking)
  - [Utils](#utils)
    - [flatten()](#flatten)
  - [Development](#development)
  - [License](#license)

## Models

For collections of objects, models can be defined by extending the Model type.
Optional and nullable properties are allowed. If you wish to use Zod, you can
create your Zod object schema and use its type as your model.

```ts
import type { Model } from "https://deno.land/x/kvdex@v0.6.1/mod.ts"

interface User extends Model {
  username: string
  age: number
  activities: string[]
  address?: {
    country: string
    city: string
    street: string
    houseNumber: number | null
  }
}
```

## Database

The "createDb" function is used for creating a new database instance. It takes a
Deno KV instance and a schema definition as arguments.

```ts
import { createDb } from "https://deno.land/x/kvdex@v0.6.1/mod.ts"

const kv = await Deno.openKv()

const db = createDb(kv, {
  numbers: (ctx) => ctx.collection<number>().build(),
  users: (ctx) => ctx.indexableCollection<User>().build({
    indices: {
      username: "primary" // unique
      age: "secondary" // non-unique
    }
  }),
  // Nested collections
  nested: {
    strings: (ctx) => ctx.collection<string>().build(),
  }
})
```

The schema definition defines collection builder functions (or nested schema definitions) which receive a builder context. Standard collections can hold any type adhering to KvValue (string, number, array, object...), while indexable collections can only hold types adhering to Model (objects). For indexable collections, primary (unique) and secondary (non-unique) indexing is supported.

## Collection Methods

### find()

The "find" method is used to retrieve a single document with the given id from
the KV store. The id must adhere to the type Deno.KvKeyPart. 
This method takes an optional options argument that can be used to set the consistency mode.

```ts
const userDoc1 = await db.users.find(123)

const userDoc2 = await db.users.find(123n)

const userDoc3 = await db.users.find("oliver", {
  consistency: "eventual", // "strong" by default
})
```

### findMany()

The "findMany" method is used to retrieve multiple documents with the given
array of ids from the KV store. The ids must adhere to the type KvId. 
This method takes an optional options argument that can be used to set the consistency mode.

```ts
const userDocs1 = await db.users.findMany(["abc", 123, 123n])

const userDocs2 = await db.users.findMany(["abc", 123, 123n], {
  consistency: "eventual", // "strong" by default
})
```

### add()

The "add" method is used to add a new document to the KV store. An id of type
string (uuid) will be generated for the document. Upon completion, a
CommitResult object will be returned with the document id, versionstamp and ok
flag.

```ts
const result = await db.users.add({
  username: "oliver",
  age: 24,
  activities: ["skiing", "running"],
  address: {
    country: "Norway",
    city: "Bergen",
    street: "Sesame",
    houseNumber: null,
  },
})

console.log(result.id) // f897e3cf-bd6d-44ac-8c36-d7ab97a82d77
```

### addMany()

The "addMany" method is used to add multiple document entries to the KV store in
a single operation. Upon completion, a list of CommitResult objects will be 
returned. For indexable collections, if any entries violate the constraints of
primary indices, those entries will not be added and the subsequent commit result
object will indicate this by the ok flag being false.

```ts
// Adds 5 new document entries to the KV store.
await results = await db.numbers.addMany(1, 2, 3, 4, 5)

// Only adds the first entry, as "username" is defined as a primary index and cannot have duplicates
await results = await db.users.addMany(
  {
    username: "oli",
    age: 24
  },
  {
    username: "oli",
    age: 56
  }
)
```

### set()

The "set" method is very similar to the "add" method, and is used to add a new
document to the KV store with a given id of type KvId. Upon completion, a
CommitResult object will be returned with the document id, versionstamp and ok
flag.

```ts
const result = await db.numbers.set("id_1", 2048)

console.log(result.id) // "id_1"
```

### update()

The "update" method is used to update the value of exisiting documents in the KV
store. For primitive values, arrays and built-in objects (Date, RegExp, etc.),
this method overrides the exisiting data with the new value. For custom objects
(Models), this method performs a partial update, merging the new value with the
existing data. Upon completion, a CommitResult object will be returned with the
document id, versionstamp and ok flag.

```ts
// Updates the document with a new value
const result1 = await db.numbers.update("num1", 42)

// Partial update, only updates the age field
const result2 = await db.users.update("user1", {
  age: 67,
})
```

### delete()

The "delete" method is used to delete one or more documents with the given ids from the KV
store.

```ts
await db.users.delete("f897e3cf-bd6d-44ac-8c36-d7ab97a82d77")

await db.users.delete("user1", "user2", "user3")
```

### deleteMany()

The "deleteMany" method is used for deleting multiple documents from the KV
store without specifying ids. 
It takes an optional options argument that can be used for filtering of documents to be deleted, and pagination.
If no options are given, "deleteMany" will delete all documents in the collection.

```ts
// Deletes all user documents
await db.users.deleteMany()

// Deletes all user documents where the user's age is above 20
await db.users.deleteMany({
  filter: (doc) => doc.value.age > 20,
})

// Deletes the first 10 user documents in the KV store
await db.users.deleteMany({
  limit: 10,
})

// Deletes the last 10 user documents in the KV store
await db.users.deleteMany({
  limit: 10,
  reverse: true,
})
```

### getMany()

The "getMany" method is used for retrieving multiple documents from the KV
store. It takes an optional options argument that can be used for filtering of
documents to be retrieved, and pagination. If no options are given, "getMany" 
will retrieve all documents in the collection.

```ts
// Retrieves all user documents
const { result } = await db.users.getMany()

// Retrieves all user documents where the user's age is above or equal to 18
const { result } = await db.users.getMany({
  filter: (doc) => doc.value.age >= 18,
})

// Retrieves the first 10 user documents in the KV store
const { result } = await db.users.getMany({
  limit: 10,
})

// Retrieves the last 10 user documents in the KV store
const { result } = await db.users.getMany({
  limit: 10,
  reverse: true,
})
```

### forEach()

The "forEach" method is used for executing a callback function for multiple
documents in the KV store. It takes an optional options argument that can be
used for filtering of documents and pagination. If no options are given,
the callback function will be executed for all documents in the collection.

```ts
// Log the username of every user document
await db.users.forEach((doc) => console.log(doc.value.username))

// Log the username of every user that has "swimming" as an activity
await db.users.forEach((doc) => console.log(doc.value.username), {
  filter: (doc) => doc.value.activities.includes("swimming"),
})

// Log the usernames of the first 10 user documents in the KV store
await db.users.forEach((doc) => console.log(doc.value.username), {
  limit: 10,
})

// Log the usernames of the last 10 user documents in the KV store
await db.users.forEach((doc) => console.log(doc.value.username), {
  limit: 10,
  reverse: true,
})
```

### map()

The "map" method is used for executing a callback function for multiple documents in the KV store, and retrieving the results. 
It takes an optional options argument that can be used for filtering of documents and pagination. 
If no options are given, the callback function will be executed for all documents in the collection.

```ts
// Get a list of all the ids of the user documents
const { result } = await db.users.map((doc) => doc.id)

// Get a list of all usernames of users with age > 20
const { result } = await db.users.map((doc) => doc.value.username, {
  filter: (doc) => doc.value.age > 20,
})

// Get a list of the usernames of the first 10 users in the KV store
const { result } = await db.users.forEach((doc) => doc.value.username, {
  limit: 10,
})

// Get a list of the usernames of the last 10 users in the KV store
const { result } = await db.users.forEach((doc) => doc.value.username, {
  limit: 10,
  reverse: true
})
```

### count()

The "count" method is used to count the number of documents in a collection. 
It takes an optional options argument that can be used for filtering of documents.
If no options are given, it will count all documents in the collection.

```ts
// Returns the total number of user documents in the KV store
const count = await db.users.count()

// Returns the number of users with age > 20
const count = await db.users.count({
  filter: doc => doc.value.age > 20
})
```

## Indexable Collection Methods

Indexable collections extend the base Collection class and provide all the same
methods. Note that add/set methods will always fail if an identical index entry
already exists.

### findByPrimaryIndex()

The "findByPrimaryIndex" method is exclusive to indexable collections and can be
used to find a document by a primary index.

```ts
// Finds a user document with the username = "oliver"
const userDoc = await db.users.findByPrimaryIndex("username", "oliver")
```

### findBySecondaryIndex()

The "findBySecondaryIndex" method is exclusive to indexable collections and
can be used to find documents by a secondary index. Secondary indices are not
unique, and therefore the result is an array of documents.

```ts
// Returns all users with age = 24
const { result } = await db.users.findBySecondaryIndex("age", 24)
```

## Database Methods

These are methods which can be found at the top level of your database object, and perform operations across multiple collections.

### countAll()

The "countAll" method is used to count the total number of documents across all collections. It takes an optional options argument that can be used to set the consistency mode.

```ts
// Gets the total number of documents in the KV store across all collections
const count = await db.countAll()
```

### deleteAll()

The "deleteAll" method is used to delete all documents in across all collections. It takes an optional options argument that can be used to set the consistency mode.

```ts
// Deletes all documents in the KV store across all collections
await db.deleteAll()
```

### atomic()

The "atomic" method is used to initiate an atomic operation. The method takes a selection function as argument for selecting the initial collection context.

```ts
db.atomic((schema) => schema.users)
```

## Atomic Operations

Atomic operations allow for executing multiple mutations as a single atomic
transaction. This means that documents can be checked for changes before
committing the mutations, in which case the operation will fail. It also ensures
that either all mutations succeed, or they all fail.

To initiate an atomic operation, call "atomic" on the database object. The
method expects a selector for selecting the collection that the subsequent
mutation actions will be performed on. Mutations can be performed on documents
from multiple collections in a single atomic operation by calling "select" at
any point in the building chain to switch the collection context. To execute the
operation, call "commit" at the end of the chain. An atomic operation returns a
Deno.KvCommitResult object if successful, and Deno.KvCommitError if not.

**NOTE:** For indexable collections, any operations performing deletes will not
be truly atomic in the sense that it performs a single isolated operation. The
reason for this being that the document data must be read before performing the
initial delete operation, to then perform another delete operation for the index
entries. If the initial operation fails, the index entries will not be deleted.
To avoid collisions and errors related to indexing, an atomic operation will
always fail if it is trying to delete and write to the same indexable
collection. It will also fail if trying to set/add a document with existing
index entries.

### Without checking

```ts
// Deletes and adds an entry to the bigints collection
const result1 = await db
  .atomic((schema) => schema.numbers)
  .delete("id_1")
  .set("id_2", 100)
  .commit()

// Adds 2 new entries to the strings collection and 1 new entry to the users collection
const result2 = await db
  .atomic((schema) => schema.numbers)
  .add(1)
  .add(2)
  .select((schema) => schema.users)
  .set("user_1", {
    username: "oliver",
    age: 24,
    activities: ["skiing", "running"],
    address: {
      country: "Norway",
      city: "Bergen",
      street: "Sesame",
      houseNumber: 42,
    },
  })
  .commit()

// Will fail and return Deno.KvCommitError because it is trying
// to both add and delete from an indexable collection
const result3 = await db
  .atomic((schema) => schema.users)
  .delete("user_1")
  .set("user_1", {
    username: "oliver",
    age: 24,
    activities: ["skiing", "running"],
    address: {
      country: "Norway",
      city: "Bergen",
      street: "Sesame",
      houseNumber: 42,
    },
  })
  .commit()
```

### With checking

```ts
// Only adds 10 to the value when it has not been changed after being read
let result = null
while (!result || !result.ok) {
  const { id, versionstamp, value } = await db.numbers.find("id")

  result = await db
    .atomic((schema) => schema.numbers)
    .check({
      id,
      versionstamp,
    })
    .set(id, value + 10)
    .commit()
}
```

## Utils

Additional utility functions.

### flatten()

The "flatten" utility function can be used to flatten documents with a value of
type Model. It will only flatten the first layer of the document, meaning the
result will be an object containing: id, versionstamp and all the entries in the
document value.

```ts
import { flatten } from "https://deno.land/x/kvdex@v0.6.1/mod.ts"

// We assume the document exists in the KV store
const doc = await db.users.find(123n)

const flattened = flatten(doc)

// Document:
// {
//   id,
//   versionstamp,
//   value
// }

// Flattened:
// {
//   id,
//   versionstamp,
//   ...userDocument.value
// }
```

## Development

Any contributions are welcomed and appreciated. How to contribute:

- Clone this repository
- Add feature / Refactor
- Add or refactor tests as needed
- Run tests using `deno task test`
- Prepare code (format + test) using `deno task prep`
- Open Pull Request

This project aims at having as high test coverage as possible to improve code quality and to avoid breaking features when refactoring. Therefore it is encouraged that any feature contributions are also accompanied by relevant unit tests to ensure those features remain stable.

The goal of kvdex is to provide a type safe, higher level API to Deno KV, while trying to retain as much of the native functionality as possible. Additionally, this module should be light-weight and should not rely on any third-party dependencies. Please kleep this in mind when making any contributions.

## License

Published under [MIT License](./LICENSE.md)
