const mongoose = require("mongoose");
const { env } = require("./env");

async function connectDb() {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.mongoUri, {
    autoIndex: env.nodeEnv !== "production",
  });

  console.log("[DB] Connected to MongoDB");
}

mongoose.connection.on("error", (e) => console.error("[DB] error", e));
mongoose.connection.on("disconnected", () => console.warn("[DB] disconnected"));


module.exports = { connectDb };
