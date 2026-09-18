import { Router } from "express";
import { calendarFeedService } from "../services/calendar-feed.service";

/**
 * Public iCal feed: `GET /api/calendar/:token.ics`. The token itself is the
 * credential, so no session is required — revoking it disables the feed.
 */
export function createCalendarRouter(): Router {
  const router = Router();

  router.get("/:token.ics", async (req, res) => {
    const token = req.params.token;
    try {
      const body = await calendarFeedService.render(token);
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="shiftflow.ics"');
      res.setHeader("Cache-Control", "no-store");
      res.send(body);
    } catch {
      res.status(404).json({ error: "Calendar feed not found" });
    }
  });

  return router;
}
