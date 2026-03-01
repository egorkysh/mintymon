CREATE TABLE "alert_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"metric_key" text NOT NULL,
	"condition" text NOT NULL,
	"threshold" real NOT NULL,
	"consecutive_breaches" integer DEFAULT 1 NOT NULL,
	"cooldown_seconds" integer DEFAULT 300 NOT NULL,
	"slack_channel" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"current_breach_count" integer DEFAULT 0 NOT NULL,
	"last_fired_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_config_id" uuid NOT NULL,
	"type" text NOT NULL,
	"metric_key" text NOT NULL,
	"metric_value" real NOT NULL,
	"threshold" real NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ingestion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text,
	"status" text NOT NULL,
	"metrics_count" integer DEFAULT 0,
	"duration_ms" integer,
	"error" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "metric_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"metric_key" text NOT NULL,
	"value" real NOT NULL,
	"unit" text NOT NULL,
	"tags" jsonb DEFAULT '{}'::jsonb,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"fetched_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_cache_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "provider_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"interval_seconds" integer DEFAULT 60 NOT NULL,
	"last_fetch_at" timestamp,
	"last_success_at" timestamp,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_configs_provider_id_unique" UNIQUE("provider_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_config_id_alert_configs_id_fk" FOREIGN KEY ("alert_config_id") REFERENCES "public"."alert_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_history_config_id_idx" ON "alert_history" USING btree ("alert_config_id");--> statement-breakpoint
CREATE INDEX "alert_history_created_at_idx" ON "alert_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ingestion_log_created_at_idx" ON "ingestion_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "metric_data_key_timestamp_idx" ON "metric_data" USING btree ("metric_key","timestamp");--> statement-breakpoint
CREATE INDEX "metric_data_created_at_idx" ON "metric_data" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");