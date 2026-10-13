-- M11 — Google Sheets: sheet chosen after the Google consent (GSH-02), title on the card, row index hint (GSH-04)
ALTER TABLE "SheetsConnection" ALTER COLUMN "spreadsheetId" DROP NOT NULL;
ALTER TABLE "SheetsConnection" ADD COLUMN "spreadsheetTitle" TEXT;
ALTER TABLE "SheetsRow" ADD COLUMN "rowIndex" INTEGER;
