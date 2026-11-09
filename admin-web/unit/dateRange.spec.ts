import { expect, test } from "@playwright/test";
import {
  addDays, apiRangeQuery, buildPresets, describeRange, fyStart, isIsoDate, matchPreset,
  quarterBounds, rangedFilename, readPage, readRange, spanDays, todayIn, validateRange,
} from "../src/lib/dateRange";

const preset = (today: string, key: string, fy = 4) => {
  const p = buildPresets(today, fy).find((x) => x.key === key);
  if (!p) throw new Error(`no preset ${key}`);
  return { from: p.from, to: p.to };
};

test("strict YYYY-MM-DD", () => {
  expect(isIsoDate("2026-11-09")).toBe(true);
  expect(isIsoDate("2028-02-29")).toBe(true);
  for (const bad of ["2026-2-01", "09/11/2026", "2026-02-30", "2027-02-29", "2026-13-01", "", "2026-11-09T00:00"]) {
    expect(isIsoDate(bad), bad).toBe(false);
  }
});

test("calendar arithmetic is timezone-free", () => {
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(spanDays("2026-11-09", "2026-11-09")).toBe(1);
  expect(spanDays("2026-04-01", "2027-03-31")).toBe(365);
});

test("presets on a Monday-start week", () => {
  // 2026-11-09 is a Monday.
  expect(preset("2026-11-09", "today")).toEqual({ from: "2026-11-09", to: "2026-11-09" });
  expect(preset("2026-11-09", "yesterday")).toEqual({ from: "2026-11-08", to: "2026-11-08" });
  expect(preset("2026-11-09", "this_week")).toEqual({ from: "2026-11-09", to: "2026-11-09" });
  expect(preset("2026-11-15", "this_week")).toEqual({ from: "2026-11-09", to: "2026-11-15" }); // Sunday
  expect(preset("2026-11-09", "last_7")).toEqual({ from: "2026-11-03", to: "2026-11-09" });
  expect(preset("2026-11-09", "last_30")).toEqual({ from: "2026-10-11", to: "2026-11-09" });
  expect(preset("2026-11-09", "mtd")).toEqual({ from: "2026-11-01", to: "2026-11-09" });
});

test("last month across a year boundary and leap February", () => {
  expect(preset("2026-01-15", "last_month")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
  expect(preset("2028-03-10", "last_month")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
});

test("Indian FY (April) to date and quarters", () => {
  expect(preset("2026-11-09", "fytd")).toEqual({ from: "2026-04-01", to: "2026-11-09" });
  expect(preset("2027-02-01", "fytd")).toEqual({ from: "2026-04-01", to: "2027-02-01" });
  expect(preset("2026-04-01", "fytd")).toEqual({ from: "2026-04-01", to: "2026-04-01" });
  expect(preset("2026-11-09", "this_quarter")).toEqual({ from: "2026-10-01", to: "2026-12-31" });
  expect(preset("2027-02-01", "this_quarter")).toEqual({ from: "2027-01-01", to: "2027-03-31" });
});

test("tenant FY setting other than April", () => {
  expect(fyStart("2026-11-09", 1)).toBe("2026-01-01");
  expect(fyStart("2026-01-09", 7)).toBe("2025-07-01");
  // FY starting February: quarters Feb–Apr, May–Jul, Aug–Oct, Nov–Jan.
  expect(quarterBounds("2027-01-20", 2)).toEqual({ from: "2026-11-01", to: "2027-01-31" });
  expect(quarterBounds("2026-11-09", 2)).toEqual({ from: "2026-11-01", to: "2027-01-31" });
});

test("every preset fits the max span", () => {
  for (const today of ["2026-11-09", "2027-03-31", "2028-03-31"]) {
    for (const p of buildPresets(today, 4)) expect(validateRange(p), `${today} ${p.key}`).toBeNull();
  }
});

test("validation mirrors the backend", () => {
  expect(validateRange({})).toBeNull();
  expect(validateRange({ from: "2026-11-09" })).toBeNull();
  expect(validateRange({ from: "2026-11-10", to: "2026-11-09" })).toMatch(/on or before/);
  expect(validateRange({ from: "2026-04-01", to: "2027-04-01" })).toBeNull(); // 366 days
  expect(validateRange({ from: "2026-04-01", to: "2027-04-02" })).toMatch(/maximum is 366/);
  expect(validateRange({ to: "2026/11/09" })).toMatch(/YYYY-MM-DD/);
});

test("URL state parsing drops invalid ranges and reports why", () => {
  expect(readRange({ from: "2026-11-01", to: "2026-11-09" })).toEqual({
    range: { from: "2026-11-01", to: "2026-11-09" }, error: null, raw: { from: "2026-11-01", to: "2026-11-09" },
  });
  const bad = readRange({ from: "2026-11-31" });
  expect(bad.range).toEqual({});
  expect(bad.error).not.toBeNull();
  expect(readPage({ page: "3" })).toBe(3);
  expect(readPage({ page: "-1" })).toBe(1);
  expect(readPage({ page: "x" })).toBe(1);
});

test("API query and labels", () => {
  expect(apiRangeQuery({})).toBe("");
  expect(apiRangeQuery({ from: "2026-11-01", to: "2026-11-09" })).toBe("&date_from=2026-11-01&date_to=2026-11-09");
  expect(apiRangeQuery({ to: "2026-11-09" }, ["period_start", "period_end"])).toBe("&period_end=2026-11-09");
  expect(describeRange({ from: "2026-11-01", to: "2026-11-09" })).toBe("1 Nov 2026 – 9 Nov 2026 (9 days)");
  expect(describeRange({})).toBe("All dates");
  expect(rangedFilename("orders.csv", { from: "2026-11-01", to: "2026-11-09" })).toBe("orders_2026-11-01_to_2026-11-09.csv");
  expect(rangedFilename("orders.csv", {})).toBe("orders.csv");
  const presets = buildPresets("2026-11-09");
  expect(matchPreset({ from: "2026-11-01", to: "2026-11-09" }, presets)?.key).toBe("mtd");
});

test("todayIn uses the tenant timezone, not the host's", () => {
  // 2026-11-09 19:00 UTC is already 10 Nov 00:30 in India.
  const instant = new Date(Date.UTC(2026, 10, 9, 19, 0));
  expect(todayIn("Asia/Kolkata", instant)).toBe("2026-11-10");
  expect(todayIn("UTC", instant)).toBe("2026-11-09");
});
