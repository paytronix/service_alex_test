import express, { Router } from "express";
import { billingService } from "../services/billing.service";
import { stripeClient } from "../services/stripe-client";

/**
 * Stripe webhook endpoint. The raw body is required for signature verification,
 * so this router installs its own `express.raw()` parser.
 */
export function createBillingRouter(): Router {
  const router = Router();

  router.post(
    "/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      let event;
      try {
        event = stripeClient.verifyWebhook(
          req.body as Buffer,
          req.header("stripe-signature") ?? undefined,
        );
      } catch (error) {
        res.status(400).json({ error: (error as Error).message });
        return;
      }
      try {
        await billingService.handleStripeEvent(event);
        res.json({ received: true });
      } catch (error) {
        console.error("[billing] failed to handle Stripe event", error);
        res.status(500).json({ error: "Failed to process event" });
      }
    },
  );

  return router;
}
