import express from "express";
import { initPayment, confirmPayment } from "../controllers/paystackController.mjs";

const router = express.Router();

// Initialize payment
router.post("/initialize", initPayment);

// Verify payment
router.get("/verify", confirmPayment);

export default router;
