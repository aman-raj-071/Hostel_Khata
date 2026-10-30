CREATE TABLE "payments" (
 "id" TEXT PRIMARY KEY,
 "group_id" TEXT NOT NULL REFERENCES "groups"("id") ON DELETE RESTRICT,
 "from_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "to_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "amount_paise" INTEGER NOT NULL CHECK ("amount_paise" > 0),
 "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','confirmed','disputed','cancelled')),
 "upi_ref" TEXT,
 "note" TEXT NOT NULL DEFAULT '',
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "confirmed_at" TIMESTAMP(3),
 "settlement_expense_id" TEXT UNIQUE REFERENCES "expenses"("id") ON DELETE RESTRICT
);
CREATE INDEX "payments_group_id_status_idx" ON "payments"("group_id","status");
