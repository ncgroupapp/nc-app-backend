import { describe, expect, it } from "vitest";
import { certificateStatus, daysUntil, todayInUruguay } from "../../../../src/contexts/certificates/certificate-status";

describe("certificateStatus", () => {
  const today = "2026-10-30";

  it("is sin_cargar without an expiry date", () => {
    expect(certificateStatus(null, 30, today)).toEqual({ status: "sin_cargar", daysLeft: null });
  });

  it("is still valid on its expiry day and expired the day after", () => {
    expect(certificateStatus("2026-10-30", 30, today)).toEqual({ status: "por_vencer", daysLeft: 0 });
    expect(certificateStatus("2026-10-29", 30, today)).toEqual({ status: "vencido", daysLeft: -1 });
  });

  it("turns por_vencer alertDays before the expiry date", () => {
    expect(certificateStatus("2026-11-29", 30, today).status).toBe("por_vencer");
    expect(certificateStatus("2026-11-30", 30, today).status).toBe("vigente");
    expect(certificateStatus("2026-11-30", 31, today).status).toBe("por_vencer");
  });
});

describe("dates", () => {
  it("counts days across months and DST changes", () => {
    expect(daysUntil("2027-03-01", "2027-02-28")).toBe(1);
    expect(daysUntil("2026-12-31", "2026-01-01")).toBe(364);
  });

  it("uses the Uruguay calendar day", () => {
    // 02:00 UTC is still the previous day in Montevideo (UTC-3)
    expect(todayInUruguay(new Date("2026-10-30T02:00:00Z"))).toBe("2026-10-29");
    expect(todayInUruguay(new Date("2026-10-30T04:00:00Z"))).toBe("2026-10-30");
  });
});
