import { scheduleCsv } from "@/lib/schedule-export";

const schedules = ["01", "02", "04", "07"] as const;

export async function GET(_request: Request, context: { params: Promise<{ schedule: string }> }) {
  const { schedule } = await context.params;
  if (!schedules.includes(schedule as (typeof schedules)[number])) {
    return new Response("Unknown schedule", { status: 404 });
  }
  const body = await scheduleCsv(schedule as (typeof schedules)[number]);
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename=schedule-${schedule}.csv`,
    },
  });
}
