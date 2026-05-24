-- Indexes for ReportTemplate and AnalyticsAlert filtering paths
-- (cron/dispatch-reports filters by schedule + isActive; admin lists by createdBy).
CREATE INDEX IF NOT EXISTS "report_templates_created_by_idx" ON "report_templates" ("created_by");
CREATE INDEX IF NOT EXISTS "report_templates_schedule_is_active_idx" ON "report_templates" ("schedule", "is_active");

CREATE INDEX IF NOT EXISTS "analytics_alerts_created_by_idx" ON "analytics_alerts" ("created_by");
CREATE INDEX IF NOT EXISTS "analytics_alerts_is_active_idx" ON "analytics_alerts" ("is_active");
