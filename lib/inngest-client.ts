/**
 * Inngest Client Configuration
 *
 * Centralized client for Inngest event-driven workflows
 */

import { Inngest } from "inngest";

export const INNGEST_APP_ID = "mato";

export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  name: "Danphe",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
