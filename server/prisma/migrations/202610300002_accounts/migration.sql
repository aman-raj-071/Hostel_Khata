CREATE TABLE "users" (
 "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL,
 "password_hash" TEXT, "upi_id" TEXT, "color" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "demo_expires_at" TIMESTAMP(3)
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_demo_expires_at_idx" ON "users"("demo_expires_at");
ALTER TABLE "groups" ADD COLUMN "created_by" TEXT;
ALTER TABLE "groups" ADD COLUMN "require_approval" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "groups" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "members" ADD COLUMN "user_id" TEXT;
ALTER TABLE "members" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';
ALTER TABLE "members" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "members" ADD COLUMN "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "members_group_id_user_id_key" ON "members"("group_id", "user_id");
CREATE TABLE "sessions" (
 "token_hash" TEXT NOT NULL PRIMARY KEY, "user_id" TEXT NOT NULL,
 "active_group_id" TEXT, "expires_at" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");
CREATE TABLE "auth_attempts" (
 "key" TEXT NOT NULL PRIMARY KEY, "failures" INTEGER NOT NULL DEFAULT 0,
 "window_start" TIMESTAMP(3) NOT NULL, "locked_until" TIMESTAMP(3)
);
