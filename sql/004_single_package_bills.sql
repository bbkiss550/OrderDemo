-- Run manually after 003_menu_catalog.sql. Old catalogs and bill snapshots remain archived.
BEGIN;
ALTER TABLE buffet_packages RENAME TO legacy_buffet_packages;
ALTER SEQUENCE buffet_packages_id_seq RENAME TO legacy_buffet_packages_id_seq;
ALTER TABLE legacy_buffet_packages RENAME CONSTRAINT buffet_packages_pkey TO legacy_buffet_packages_pkey;
ALTER TABLE menu_packages RENAME TO legacy_menu_packages;
ALTER TABLE legacy_menu_packages RENAME CONSTRAINT menu_packages_pkey TO legacy_menu_packages_pkey;
CREATE TABLE buffet_packages (
 id bigserial PRIMARY KEY, name varchar(100) NOT NULL UNIQUE CHECK (length(trim(name))>0),
 adult_price numeric(12,2) CHECK (adult_price>=0),
 child_price numeric(12,2) CHECK (child_price>=0),
 active boolean NOT NULL DEFAULT true, version bigint NOT NULL DEFAULT 0
);
-- Pair unambiguous adult/child variants. Missing rates stay NULL, never silently become free.
CREATE TEMP TABLE package_names ON COMMIT DROP AS
 WITH normalized AS (
 SELECT p.*,CASE WHEN name IN ('บุฟเฟต์มาตรฐาน ผู้ใหญ่','บุฟเฟต์มาตรฐาน เด็ก') THEN 'Standard'
 ELSE coalesce(nullif(trim(regexp_replace(name,'\s+(ผู้ใหญ่|เด็ก|ADULT|CHILD)$','','i')),''),name) END AS base
 FROM legacy_buffet_packages p
 ), counts AS (SELECT base,max(n) AS n FROM (SELECT base,audience,count(*) AS n FROM normalized GROUP BY base,audience) x GROUP BY base)
 SELECT p.*,CASE WHEN c.n>1 THEN left(p.base,75)||' #'||p.id ELSE p.base END AS plan_name
 FROM normalized p JOIN counts c ON c.base=p.base;
INSERT INTO buffet_packages(name,adult_price,child_price,active)
 SELECT plan_name,max(price) FILTER(WHERE audience='ADULT'),max(price) FILTER(WHERE audience='CHILD'),bool_and(active)
 FROM package_names GROUP BY plan_name ORDER BY min(id);
CREATE TABLE legacy_package_mapping (
 legacy_package_id bigint PRIMARY KEY REFERENCES legacy_buffet_packages(id),
 package_id bigint NOT NULL REFERENCES buffet_packages(id)
);
INSERT INTO legacy_package_mapping SELECT p.id,n.id FROM package_names p JOIN buffet_packages n ON n.name=p.plan_name;
INSERT INTO buffet_packages(name,adult_price,child_price) VALUES ('Deluxe',599,399),('Premium',899,699) ON CONFLICT(name) DO NOTHING;
CREATE TABLE menu_packages (
 menu_id bigint NOT NULL REFERENCES food_menus(id), package_id bigint NOT NULL REFERENCES buffet_packages(id),
 PRIMARY KEY(menu_id,package_id)
);
INSERT INTO menu_packages SELECT DISTINCT l.menu_id,m.package_id FROM legacy_menu_packages l JOIN legacy_package_mapping m ON m.legacy_package_id=l.package_id;
CREATE INDEX menu_packages_plan_idx ON menu_packages(package_id);
ALTER TABLE bills ADD COLUMN package_id bigint REFERENCES buffet_packages(id);
ALTER TABLE bills ADD COLUMN package_name varchar(100);
ALTER TABLE bills ADD COLUMN bill_format varchar(20) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE bills ALTER COLUMN bill_format SET DEFAULT 'SINGLE_PACKAGE';
ALTER TABLE bills ADD CONSTRAINT bill_package_format CHECK
 ((bill_format='LEGACY' AND package_id IS NULL) OR (bill_format='SINGLE_PACKAGE' AND package_id IS NOT NULL AND package_name IS NOT NULL));
ALTER TABLE bills ADD CONSTRAINT bill_package_pair UNIQUE(id,package_id);
ALTER TABLE bill_lines RENAME COLUMN package_id TO legacy_package_id;
ALTER TABLE bill_lines ALTER COLUMN legacy_package_id DROP NOT NULL;
ALTER TABLE bill_lines ADD COLUMN package_id bigint REFERENCES buffet_packages(id);
ALTER TABLE bill_lines ADD CONSTRAINT line_single_package FOREIGN KEY(bill_id,package_id) REFERENCES bills(id,package_id);
ALTER TABLE bill_lines ADD CONSTRAINT line_package_source CHECK ((legacy_package_id IS NULL)<>(package_id IS NULL));
ALTER TABLE bill_lines ADD CONSTRAINT line_audience CHECK(audience IN ('ADULT','CHILD'));
CREATE UNIQUE INDEX bill_one_audience_per_package ON bill_lines(bill_id,audience) WHERE package_id IS NOT NULL;
COMMIT;
