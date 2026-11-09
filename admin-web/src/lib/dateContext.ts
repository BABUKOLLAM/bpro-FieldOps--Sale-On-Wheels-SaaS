import { cache } from "react";
import { apiGet } from "./api";
import { DEFAULT_MAX_SPAN_DAYS, todayIn, type DateContext } from "./dateRange";

/** The tenant's calendar settings for the From–To picker (tenant-local
 * today, timezone, FY start month, max span), fetched once per request.
 * Falls back to India defaults (Asia/Kolkata, April FY) if the backend
 * call fails, so a picker never takes a page down. */
export const getDateContext = cache(async (): Promise<DateContext> => {
  try {
    return await apiGet<DateContext>("/api/reporting/date-context/");
  } catch {
    return {
      today: todayIn("Asia/Kolkata"),
      timezone: "Asia/Kolkata",
      fy_start_month: 4,
      max_span_days: DEFAULT_MAX_SPAN_DAYS,
    };
  }
});
