-- Run manually after 005. No automatic schema changes at application startup.
BEGIN;
CREATE TABLE order_rounds (
 id bigserial PRIMARY KEY,
 bill_id bigint NOT NULL REFERENCES bills(id),
 round_no integer NOT NULL CHECK (round_no>0),
 request_key uuid NOT NULL,
 request_hash varchar(64) NOT NULL,
 table_name_at_order varchar(30) NOT NULL,
 status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COOKING','READY','SERVED')),
 version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(bill_id,round_no), UNIQUE(bill_id,request_key)
);
CREATE TABLE order_items (
 id bigserial PRIMARY KEY,
 round_id bigint NOT NULL REFERENCES order_rounds(id),
 menu_id bigint NOT NULL REFERENCES food_menus(id),
 menu_name varchar(120) NOT NULL,
 category_name varchar(80) NOT NULL,
 emoji varchar(32) NOT NULL,
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
 status varchar(10) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COOKING','READY','SERVED')),
 started_at timestamptz, ready_at timestamptz, served_at timestamptz,
 UNIQUE(round_id,menu_id)
);
CREATE INDEX order_rounds_bill_idx ON order_rounds(bill_id,id DESC);
CREATE INDEX order_rounds_queue_idx ON order_rounds(status,created_at,id);
CREATE INDEX order_items_round_idx ON order_items(round_id,id);
COMMIT;
