import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import taskRoutes from "./routes/taskRoutes";
import robotRoutes from "./routes/robotRoutes";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/robot", robotRoutes);

app.get("/", (req, res) => {
  res.send("API is running...");
});

export default app;
