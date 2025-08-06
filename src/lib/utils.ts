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
