import express from "express";
import { getTasks, createTask, updateTask, deleteTask } from "../controllers/taskController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getTasks)
  .post(createTask);

router.route("/:id")
  .patch(updateTask)
  .delete(deleteTask);

export default router;
