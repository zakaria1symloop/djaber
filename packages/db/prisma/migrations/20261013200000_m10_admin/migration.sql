-- M10: platform totals of sched-daily-stats (ADM-01)
CREATE TABLE "PlatformDailyStat" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "day" DATE NOT NULL,
    "metrics" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformDailyStat_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformDailyStat_day_key" ON "PlatformDailyStat"("day");
