/**
 * Inngest Client Configuration
 *
 * Centralized client for Inngest event-driven workflows
 */

import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "pocket-dev",
  name: "Pocket Dev",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
