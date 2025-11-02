import { initializePayment, verifyPayment } from "../services/paystackService.js";

/**
 * Initialize Payment Controller
 */
export const initPayment = async (req, res) => {
  try {
    const { email, amount, callback_url } = req.body;
    if (!email || !amount) {
      return res.status(400).json({ error: "Email and amount are required." });
    }

    const paymentData = await initializePayment(email, amount, callback_url);
    res.status(200).json({
      message: "Payment initialized successfully.",
      ...paymentData,
    });
  } catch (error) {
    console.error("Paystack init error:", error.message);
    res.status(500).json({ error: "Payment initialization failed." });
  }
};

/**
 * Verify Payment Controller
 */
export const confirmPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).json({ error: "Reference is required." });
    }

    const verificationData = await verifyPayment(reference);

    if (verificationData.status === "success") {
      // TODO: Save transaction to DB, mark user as paid, etc.
      res.status(200).json({
        message: "Payment verified successfully.",
        data: verificationData,
      });
    } else {
      res.status(400).json({
        message: "Payment not successful.",
        data: verificationData,
      });
    }
  } catch (error) {
    console.error("Paystack verify error:", error.message);
    res.status(500).json({ error: "Payment verification failed." });
  }
};
