import express from "express";
import { signUp, signIn, getMe } from "../controllers/authController";
import { protect } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/signup", signUp);
router.post("/signin", signIn);
router.get("/me", protect, getMe);

export default router;
