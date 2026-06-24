// Query the saunaman MongoDB for validation snapshots.
// Usage: node db-query.mjs <Collection|model> '<JSON filter>'
// Examples:
//   node db-query.mjs reservations '{}'
//   node db-query.mjs events '{"name":"Sunset Sauna"}'
// Prints { count, docs } as JSON. Uses MONGO_URI from .env (defaults to local saunaman).
import mongoose from "mongoose";
import { readFileSync } from "node:fs";

// minimal .env loader (avoids extra deps; only reads MONGO_URI)
let MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  try {
    const env = readFileSync(new URL("../../../../.env", import.meta.url), "utf8");
    MONGO_URI = env.split("\n").find((l) => l.startsWith("MONGO_URI="))?.slice("MONGO_URI=".length).trim();
  } catch {}
}
MONGO_URI = MONGO_URI || "mongodb://localhost:27017/saunaman";

const [, , collArg, filterArg = "{}"] = process.argv;
if (!collArg) {
  console.error("usage: node db-query.mjs <collection> '<JSON filter>'");
  process.exit(1);
}
// normalize to a Mongo collection name (lowercase, pluralized-ish as Mongoose does)
const coll = collArg.toLowerCase().endsWith("s") ? collArg.toLowerCase() : collArg.toLowerCase() + "s";
const filter = JSON.parse(filterArg);

await mongoose.connect(MONGO_URI);
const docs = await mongoose.connection.db
  .collection(coll)
  .find(filter)
  .sort({ updatedAt: -1, _id: -1 })
  .limit(25)
  .toArray();
console.log(JSON.stringify({ collection: coll, count: docs.length, docs }, null, 2));
await mongoose.disconnect();
