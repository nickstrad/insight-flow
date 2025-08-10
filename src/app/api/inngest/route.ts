import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import {
  transcribeVideosHandler,
  transcribeExistingVideosHandler,
  transcribeVideosOnlyHandler,
  retryVideoHandler,
  startTranscriptionNotification,
} from "@/inngest/functions";

// Create an API that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    transcribeVideosHandler,
    transcribeExistingVideosHandler,
    transcribeVideosOnlyHandler,
    retryVideoHandler,
    startTranscriptionNotification,
  ],
});
