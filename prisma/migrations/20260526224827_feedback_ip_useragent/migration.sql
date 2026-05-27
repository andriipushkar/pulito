-- Add forensics columns so spam-bursts can be traced back to source IP and
-- abusive UA strings can be banned at edge. Nullable + no default — old rows
-- stay untouched.

ALTER TABLE "feedback"
  ADD COLUMN "ip_address" VARCHAR(45),
  ADD COLUMN "user_agent" VARCHAR(500);
