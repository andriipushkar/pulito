-- Add `partial` status: some channels published, others failed. The previous
-- code marked this as `published` which hid problems from operators.
ALTER TYPE "PublicationStatus" ADD VALUE IF NOT EXISTS 'partial';
