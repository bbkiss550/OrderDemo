-- Run manually using psql -v ON_ERROR_STOP=1 -f sql/001_admin.sql.
-- No application startup migration / schema creation.
BEGIN;
CREATE TABLE shop_settings (
 id integer PRIMARY KEY CHECK (id = 1), name varchar(120) NOT NULL,
 vat_included boolean NOT NULL, vat_rate numeric(5,2) NOT NULL CHECK (vat_rate BETWEEN 0 AND 100),
 penalty numeric(12,2) NOT NULL CHECK (penalty >= 0), duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
 paper_width numeric(6,2) NOT NULL CHECK (paper_width BETWEEN 40 AND 300),
 paper_margin numeric(5,2) NOT NULL CHECK (paper_margin >= 0 AND paper_margin < paper_width / 2),
 public_base_url varchar(250) NOT NULL
);
CREATE TABLE buffet_packages (
 id bigserial PRIMARY KEY, name varchar(100) NOT NULL, audience varchar(10) NOT NULL CHECK (audience IN ('ADULT','CHILD')),
 price numeric(12,2) NOT NULL CHECK (price >= 0), active boolean NOT NULL DEFAULT true
);
CREATE TABLE dining_tables (
 id bigserial PRIMARY KEY, name varchar(30) NOT NULL UNIQUE, capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100), active boolean NOT NULL DEFAULT true
);
CREATE TABLE bills (
 id bigserial PRIMARY KEY, table_id bigint NOT NULL REFERENCES dining_tables(id), table_name varchar(30) NOT NULL,
 qr_token varchar(64) NOT NULL UNIQUE, request_key uuid NOT NULL UNIQUE,
 status varchar(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PAID')),
 opened_at timestamptz NOT NULL DEFAULT now(), ends_at timestamptz NOT NULL,
 duration_minutes integer NOT NULL, shop_name varchar(120) NOT NULL,
 vat_included boolean NOT NULL, vat_rate numeric(5,2) NOT NULL,
 subtotal numeric(12,2) NOT NULL, vat numeric(12,2) NOT NULL, total numeric(12,2) NOT NULL,
 penalty_rate numeric(12,2) NOT NULL, penalty_applied boolean NOT NULL DEFAULT false,
 paid_total numeric(12,2), paid_at timestamptz, payment_method varchar(20),
 public_base_url varchar(250) NOT NULL,
 CHECK (ends_at > opened_at),
 CHECK ((status = 'OPEN' AND paid_at IS NULL) OR (status = 'PAID' AND paid_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_open_bill_per_table ON bills(table_id) WHERE status = 'OPEN';
CREATE TABLE bill_lines (
 id bigserial PRIMARY KEY, bill_id bigint NOT NULL REFERENCES bills(id), package_id bigint NOT NULL REFERENCES buffet_packages(id),
 package_name varchar(100) NOT NULL, audience varchar(10) NOT NULL, price numeric(12,2) NOT NULL,
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100), UNIQUE(bill_id,package_id)
);
INSERT INTO shop_settings VALUES (1,'FoodFlow ชาบู & กริลล์',true,7,100,90,80,4,'http://localhost:8088');
INSERT INTO buffet_packages(name,audience,price) VALUES ('บุฟเฟต์มาตรฐาน ผู้ใหญ่','ADULT',399),('บุฟเฟต์มาตรฐาน เด็ก','CHILD',199);
INSERT INTO dining_tables(name,capacity) VALUES ('A01',6),('A02',6),('A03',6),('A04',6),('B01',8),('B02',8);
COMMIT;
