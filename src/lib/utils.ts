import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Convert ISO 8601 duration (e.g., "PT4M13S") to minutes rounded up
export function convertDurationToMinutes(duration = ""): number {
  try {
    if (!duration) return 0;

    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    const totalMinutes = hours * 60 + minutes + seconds / 60;
    return Math.ceil(totalMinutes);
  } catch (error) {
    console.log("Error converting duration:", duration, error);
    return 0;
  }
}

// Helper function to retry failed operations up to 3 times with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  operationName: string = "API call"
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  = ${operationName} - Attempt ${attempt}/${maxRetries}`);
      const result = await operation();

      if (attempt > 1) {
        console.log(`   ${operationName} succeeded on attempt ${attempt}`);
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (attempt === maxRetries) {
        console.error(
          `  L ${operationName} failed after ${maxRetries} attempts:`,
          lastError.message
        );
        throw lastError;
      }

      // Calculate exponential backoff delay: 1s, 2s, 4s, 8s...
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `  � ${operationName} failed on attempt ${attempt}/${maxRetries}: ${lastError.message}. Retrying in ${delayMs}ms...`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError!;
}
