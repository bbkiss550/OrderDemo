-- Run manually after 004. Existing bills, menus and settings are preserved.
BEGIN;
CREATE TABLE staff_users (
 id bigserial PRIMARY KEY,
 username varchar(60) NOT NULL CHECK (length(trim(username))>0),
 display_name varchar(100) NOT NULL CHECK (length(trim(display_name))>0),
 password_hash varchar(120) NOT NULL,
 role varchar(10) NOT NULL CHECK (role IN ('ADMIN','CASHIER','KITCHEN')),
 active boolean NOT NULL DEFAULT true,
 version bigint NOT NULL DEFAULT 0, auth_version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX staff_username_unique ON staff_users(lower(username));
CREATE TABLE audit_events (
 id bigserial PRIMARY KEY, occurred_at timestamptz NOT NULL DEFAULT now(),
 actor varchar(60) NOT NULL, action varchar(40) NOT NULL,
 entity_type varchar(20) NOT NULL, entity_id bigint NOT NULL,
 before_data jsonb, after_data jsonb
);
CREATE INDEX audit_events_time_idx ON audit_events(occurred_at DESC,id DESC);
CREATE INDEX audit_events_entity_idx ON audit_events(entity_type,entity_id);
CREATE INDEX bills_opened_history_idx ON bills(opened_at DESC,id DESC);
CREATE INDEX bills_paid_history_idx ON bills(paid_at DESC,id DESC) WHERE status='PAID';
COMMIT;
