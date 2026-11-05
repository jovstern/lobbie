CREATE TYPE "public"."expense_category" AS ENUM('cleaning', 'garden', 'elevator', 'electricity', 'water', 'repairs', 'insurance', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'transfer', 'check', 'bit', 'other');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('resident', 'committee', 'admin');--> statement-breakpoint
CREATE TABLE "apartment_residents" (
	"user_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apartment_residents_pk" PRIMARY KEY("user_id","apartment_id")
);
--> statement-breakpoint
CREATE TABLE "apartments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"number" text NOT NULL,
	"floor" integer NOT NULL,
	"billing_start_month" char(7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apartments_building_id_number_unique" UNIQUE("building_id","number"),
	CONSTRAINT "apartments_id_building_id_unique" UNIQUE("id","building_id"),
	CONSTRAINT "apartments_billing_start_month_format" CHECK ("apartments"."billing_start_month" ~ '^\d{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "balance_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"amount_agorot" integer NOT NULL,
	"reason" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "balance_adjustments_amount_non_zero" CHECK ("balance_adjustments"."amount_agorot" <> 0)
);
--> statement-breakpoint
CREATE TABLE "building_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"role" "role" DEFAULT 'resident' NOT NULL,
	"committee_title" text,
	"show_contact" boolean DEFAULT false NOT NULL,
	"committee_phone" text,
	"committee_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "building_members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Jerusalem' NOT NULL,
	"quorum_percent" integer DEFAULT 50 NOT NULL,
	"opening_balance_agorot" integer DEFAULT 0 NOT NULL,
	"billing_start_month" char(7) NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buildings_quorum_percent_range" CHECK ("buildings"."quorum_percent" BETWEEN 1 AND 100),
	CONSTRAINT "buildings_opening_balance_non_negative" CHECK ("buildings"."opening_balance_agorot" >= 0),
	CONSTRAINT "buildings_billing_start_month_format" CHECK ("buildings"."billing_start_month" ~ '^\d{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount_agorot" integer NOT NULL,
	"spent_on" date NOT NULL,
	"description" text NOT NULL,
	"receipt_key" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount_agorot" > 0),
	CONSTRAINT "expenses_void_all_or_none" CHECK (("expenses"."voided_at" IS NULL AND "expenses"."voided_by" IS NULL AND "expenses"."void_reason" IS NULL)
        OR ("expenses"."voided_at" IS NOT NULL AND "expenses"."voided_by" IS NOT NULL AND "expenses"."void_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "fee_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"apartment_id" uuid,
	"amount_agorot" integer NOT NULL,
	"effective_from" char(7) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fee_rates_building_apartment_effective_from_unique" UNIQUE NULLS NOT DISTINCT("building_id","apartment_id","effective_from"),
	CONSTRAINT "fee_rates_amount_positive" CHECK ("fee_rates"."amount_agorot" > 0),
	CONSTRAINT "fee_rates_effective_from_format" CHECK ("fee_rates"."effective_from" ~ '^\d{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"apartment_id" uuid NOT NULL,
	"month" char(7) NOT NULL,
	"amount_agorot" integer NOT NULL,
	"paid_on" date NOT NULL,
	"method" "payment_method" NOT NULL,
	"note" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"void_reason" text,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_agorot" > 0),
	CONSTRAINT "payments_month_format" CHECK ("payments"."month" ~ '^\d{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "payments_void_all_or_none" CHECK (("payments"."voided_at" IS NULL AND "payments"."voided_by" IS NULL AND "payments"."void_reason" IS NULL)
        OR ("payments"."voided_at" IS NOT NULL AND "payments"."voided_by" IS NOT NULL AND "payments"."void_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" text,
	"locale" text DEFAULT 'he',
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "apartment_residents" ADD CONSTRAINT "apartment_residents_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartment_residents" ADD CONSTRAINT "apartment_residents_apartment_id_apartments_id_fk" FOREIGN KEY ("apartment_id") REFERENCES "public"."apartments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apartments" ADD CONSTRAINT "apartments_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "balance_adjustments" ADD CONSTRAINT "balance_adjustments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_members" ADD CONSTRAINT "building_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "building_members" ADD CONSTRAINT "building_members_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rates" ADD CONSTRAINT "fee_rates_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rates" ADD CONSTRAINT "fee_rates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fee_rates" ADD CONSTRAINT "fee_rates_apartment_building_fk" FOREIGN KEY ("apartment_id","building_id") REFERENCES "public"."apartments"("id","building_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_user_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_apartment_building_fk" FOREIGN KEY ("apartment_id","building_id") REFERENCES "public"."apartments"("id","building_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apartment_residents_apartment_id_idx" ON "apartment_residents" USING btree ("apartment_id");--> statement-breakpoint
CREATE INDEX "balance_adjustments_building_id_idx" ON "balance_adjustments" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "building_members_building_id_idx" ON "building_members" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "expenses_building_id_spent_on_idx" ON "expenses" USING btree ("building_id","spent_on");--> statement-breakpoint
CREATE INDEX "fee_rates_building_id_effective_from_idx" ON "fee_rates" USING btree ("building_id","effective_from");--> statement-breakpoint
CREATE INDEX "payments_apartment_id_month_idx" ON "payments" USING btree ("apartment_id","month");--> statement-breakpoint
CREATE INDEX "payments_building_id_month_idx" ON "payments" USING btree ("building_id","month");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");