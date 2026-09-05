import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { connectDB } from "./config/database";
import { startScheduler } from "./services/scheduler";

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  // Start the V3 proactive intelligence scheduler
  startScheduler();

  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
  });
});

