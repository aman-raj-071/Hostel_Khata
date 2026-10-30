ALTER TABLE "members" RENAME TO "group_members";
CREATE TABLE "group_invites" (
 "id" TEXT NOT NULL PRIMARY KEY, "group_id" TEXT NOT NULL, "code" TEXT NOT NULL,
 "created_by" TEXT NOT NULL, "expires_at" TIMESTAMP(3) NOT NULL,
 "max_uses" INTEGER, "uses" INTEGER NOT NULL DEFAULT 0,
 "revoked" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "group_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "group_invites_code_key" ON "group_invites"("code");
CREATE INDEX "group_invites_group_id_idx" ON "group_invites"("group_id");
