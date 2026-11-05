CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"max_uses" integer DEFAULT 6 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invites_code_hash_unique" UNIQUE("code_hash"),
	CONSTRAINT "invites_uses_within_max" CHECK ("invites"."uses" BETWEEN 0 AND "invites"."max_uses"),
	CONSTRAINT "invites_max_uses_positive" CHECK ("invites"."max_uses" > 0)
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_apartment_building_fk" FOREIGN KEY ("apartment_id","building_id") REFERENCES "public"."apartments"("id","building_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invites_apartment_id_idx" ON "invites" USING btree ("apartment_id");