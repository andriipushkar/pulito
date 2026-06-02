-- Nova Poshta InternetDocument Ref (UUID), stored on TTN creation.
-- Required for operations the 14-digit EN number can't address:
-- cancelling a TTN (InternetDocument.delete) and grouping into a
-- ScanSheet/реєстр (ScanSheet.insertDocuments). Nullable — manually
-- entered tracking numbers have no Ref.
ALTER TABLE "orders" ADD COLUMN "tracking_ref" TEXT;
