CREATE TABLE "groups" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "groups_code_key" ON "groups"("code");
CREATE TABLE "members" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "group_id" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "upi_id" TEXT
);
CREATE UNIQUE INDEX "members_group_id_name_key" ON "members"("group_id", "name");
CREATE UNIQUE INDEX "members_group_name_case_key" ON "members"("group_id", lower("name"));
CREATE INDEX "members_group_id_idx" ON "members"("group_id");
CREATE TABLE "expenses" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "group_id" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "payer_id" TEXT NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amount_paise" INTEGER NOT NULL CHECK ("amount_paise" > 0),
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL CHECK ("category" IN ('food','rent','utilities','travel','groceries','other')),
  "date" TEXT NOT NULL,
  "raw_text" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "expenses_group_id_date_idx" ON "expenses"("group_id", "date");
CREATE INDEX "expenses_payer_id_idx" ON "expenses"("payer_id");
CREATE TABLE "expense_shares" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expense_id" TEXT NOT NULL REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "member_id" TEXT NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "share_paise" INTEGER NOT NULL CHECK ("share_paise" >= 0)
);
CREATE UNIQUE INDEX "expense_shares_expense_id_member_id_key" ON "expense_shares"("expense_id", "member_id");
CREATE INDEX "expense_shares_member_id_idx" ON "expense_shares"("member_id");
