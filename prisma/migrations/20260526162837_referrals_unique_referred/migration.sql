-- One referral row per referred user. Existing duplicates (from prior race
-- conditions, if any) get the second/N-th row deleted, keeping the OLDEST
-- (smallest id) since that's the one whose attribution is most likely the
-- legitimate first-touch referrer.
--
-- Run cleanup BEFORE the unique constraint or PG will refuse to create it.

DELETE FROM "referrals" a
USING "referrals" b
WHERE a.id > b.id
  AND a.referred_user_id = b.referred_user_id;

CREATE UNIQUE INDEX "referrals_referred_user_id_key"
  ON "referrals"("referred_user_id");
