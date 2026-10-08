-- Isolated schema only. Does not read or modify the application's public tables.
CREATE SCHEMA qa_single_package_check;
SET search_path=qa_single_package_check;
\ir ../sql/001_admin.sql
\ir ../sql/002_floor_plan.sql
\ir ../sql/003_menu_catalog.sql
INSERT INTO bills(table_id,opening_table_id,table_name,qr_token,request_key,opened_at,ends_at,duration_minutes,shop_name,vat_included,vat_rate,subtotal,vat,total,penalty_rate,public_base_url)
 VALUES(1,1,'A01','legacy-check','00000000-0000-4000-8000-000000000001',now(),now()+interval '90 minutes',90,'Legacy shop',true,7,1303.74,91.26,1395,100,'http://localhost:8088');
INSERT INTO bill_lines(bill_id,package_id,package_name,audience,price,quantity) VALUES(1,1,'Legacy adult','ADULT',399,2),(1,2,'Legacy child','CHILD',199,3);
INSERT INTO food_menus(category_id,name) VALUES(1,'Legacy food');
INSERT INTO menu_packages VALUES(1,1),(1,2);
\ir ../sql/004_single_package_bills.sql
DO $$
BEGIN
 IF (SELECT total FROM bills WHERE id=1)<>1395 OR (SELECT bill_format FROM bills WHERE id=1)<>'LEGACY' OR (SELECT count(*) FROM bill_lines WHERE bill_id=1 AND legacy_package_id IS NOT NULL AND package_id IS NULL)<>2 THEN RAISE EXCEPTION 'Legacy bill changed'; END IF;
 IF (SELECT sum(price*quantity) FROM bill_lines WHERE bill_id=1)<>1395 THEN RAISE EXCEPTION 'Legacy price snapshot changed'; END IF;
 IF (SELECT count(*) FROM menu_packages WHERE menu_id=1)<>1 OR (SELECT name FROM buffet_packages WHERE id=(SELECT package_id FROM menu_packages WHERE menu_id=1))<>'Standard' THEN RAISE EXCEPTION 'Menu access not paired'; END IF;
 IF (SELECT count(*) FROM buffet_packages WHERE name='Standard' AND adult_price=399 AND child_price=199)<>1 THEN RAISE EXCEPTION 'Paired rates incorrect'; END IF;
END $$;
INSERT INTO bills(table_id,opening_table_id,table_name,qr_token,request_key,opened_at,ends_at,duration_minutes,shop_name,vat_included,vat_rate,subtotal,vat,total,penalty_rate,public_base_url,package_id,package_name)
 VALUES(2,2,'A02','new-check','00000000-0000-4000-8000-000000000002',now(),now()+interval '90 minutes',90,'New shop',true,7,1303.74,91.26,1395,100,'http://localhost:8088',1,'Standard');
INSERT INTO bill_lines(bill_id,package_id,package_name,audience,price,quantity) VALUES(2,1,'Standard','ADULT',399,2),(2,1,'Standard','CHILD',199,3);
INSERT INTO bills(table_id,opening_table_id,table_name,qr_token,request_key,opened_at,ends_at,duration_minutes,shop_name,vat_included,vat_rate,subtotal,vat,total,penalty_rate,public_base_url,package_id,package_name)
 SELECT 3,3,'A03','fk-check','00000000-0000-4000-8000-000000000003',opened_at,ends_at,duration_minutes,shop_name,vat_included,vat_rate,subtotal,vat,total,penalty_rate,public_base_url,package_id,package_name FROM bills WHERE id=2;
DO $$
BEGIN
 BEGIN
  INSERT INTO bill_lines(bill_id,package_id,package_name,audience,price,quantity) VALUES(3,2,'Deluxe','ADULT',599,1);
  RAISE EXCEPTION 'A different package was accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  INSERT INTO bill_lines(bill_id,package_id,package_name,audience,price,quantity) VALUES(2,1,'Standard','ADULT',399,1);
  RAISE EXCEPTION 'Duplicate audience was accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
RESET search_path;
DROP SCHEMA qa_single_package_check CASCADE;
SELECT 'PASS: fresh install, legacy snapshots/menu access preserved, database single-package and audience constraints' AS result;
