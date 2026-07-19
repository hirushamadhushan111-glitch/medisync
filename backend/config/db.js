/**
 * db.js — MongoDB connection with retry logic.
 * Called once at startup (server.js); exits the process only after all
 * retries fail, since the API cannot run without the database.
 */
const mongoose = require('mongoose');

// Transient DNS/network failures (common on local ISPs at boot) should not
// kill the server instantly — retry with a growing delay before giving up.
const MAX_RETRIES = 6;

// Connect to MongoDB, retrying with a growing delay on network failures.
const connectDB = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        family: 4, // force IPv4 — avoids flaky ENOTFOUND lookups on some routers/ISPs
        minPoolSize: 5,          // keep warm connections so parallel queries skip TLS handshakes
        compressors: ['zlib'],   // compress wire traffic — big win on slow links
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`MongoDB Connection Error (attempt ${attempt}/${MAX_RETRIES}): ${error.message}`);
      if (attempt === MAX_RETRIES) {
        console.error('Could not reach MongoDB — check your internet connection, then restart the server.');
        process.exit(1);
      }
      const delaySeconds = attempt * 5;
      console.log(`Retrying in ${delaySeconds}s…`);
      await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
    }
  }
};

module.exports = connectDB;
