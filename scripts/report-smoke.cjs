// Read-only API checks plus temporary PostgreSQL report fixtures rolled back on completion.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const env=Object.fromEntries(fs.readFileSync(path.join(root,'.env'),'utf8').trim().split(/\r?\n/).filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).replace(/^\uFEFF/,''),l.slice(i+1)];}));
// Use the exact SQL constants from the service, including its grouping expressions.
const source=fs.readFileSync(path.join(root,'src/main/java/com/foodflow/ReportService.java'),'utf8'),sql={};
for(const match of source.matchAll(/static final String (\w+) = """\r?\n([\s\S]*?)""";/g))sql[match[1]]=match[2];
for(const match of source.matchAll(/static final String (\w+) = (?!""")([\s\S]*?);/g))sql[match[1]]=[...match[2].matchAll(/"(?:\\.|[^"\\])*"|\bTOTALS\b/g)].map(t=>t[0]==='TOTALS'?sql.TOTALS:JSON.parse(t[0])).join('');
const since="'2026-10-18T17:00:00Z'::timestamptz",until="'2026-10-19T17:00:00Z'::timestamptz";
function query(name,empty=false){let index=0;return (sql.PAID+sql[name]).replace(/\?/g,()=>empty?"'2030-01-01T00:00:00Z'::timestamptz":[since,until][index++]);}
function output(empty=false){return `SELECT jsonb_build_object('summary',(SELECT row_to_json(r) FROM (${query('SUMMARY',empty)}) r),${['DAILY','PAYMENTS','PACKAGES'].map(name=>`'${name.toLowerCase()}',(SELECT coalesce(json_agg(r),'[]'::json) FROM (${query(name,empty)}) r)`).join(',')});`;}
const fixtures=`BEGIN;
CREATE TEMP TABLE bills(id bigint,status text,paid_at timestamptz,subtotal numeric,vat numeric,total numeric,penalty_rate numeric,penalty_applied boolean,paid_total numeric,payment_method text,package_id bigint,package_name text) ON COMMIT DROP;
CREATE TEMP TABLE bill_lines(bill_id bigint,audience text,quantity integer) ON COMMIT DROP;
INSERT INTO bills VALUES
 (1,'PAID','2026-10-18T17:00:00Z',100,7,107,100,true,207,'CASH',1,'Standard ราคาเดิม'),
 (2,'PAID','2026-10-19T16:59:59.999Z',200,14,214,100,false,214,'TRANSFER',1,'Standard ราคาเดิม'),
 (3,'PAID','2026-10-19T17:00:00Z',100000,0,100000,0,false,100000,'CASH',1,'อยู่นอกช่วง'),
 (4,'PAID','2026-10-18T16:59:59.999Z',100000,0,100000,0,false,100000,'CASH',1,'อยู่นอกช่วง'),
 (5,'OPEN',NULL,100000,0,100000,0,false,NULL,NULL,1,'ยังไม่ชำระ'),
 (6,'PAID','2026-10-19T03:00:00Z',50,3.5,53.5,100,false,53.5,'CARD',NULL,NULL);
INSERT INTO bill_lines VALUES (1,'ADULT',2),(1,'CHILD',3),(2,'ADULT',1),(3,'ADULT',99),(4,'CHILD',99),(5,'ADULT',99),(6,'ADULT',1),(6,'CHILD',1);
${output()}
${output(true)}
ROLLBACK;`;
const psql=env.PSQL_PATH||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const pg=spawnSync(psql,['-h','localhost','-p','5432','-U',env.DB_USERNAME||'postgres','-d','db_order_demo','-w','-X','-qAt','-v','ON_ERROR_STOP=1'],{input:fixtures,encoding:'utf8',env:{...process.env,PGPASSWORD:env.DB_PASSWORD,PGCLIENTENCODING:'UTF8'}});
if(pg.error)throw pg.error;assert.equal(pg.status,0,pg.stderr);
const [fixture,empty]=pg.stdout.trim().split(/\r?\n/).filter(line=>line.startsWith('{')).map(JSON.parse);
assert.deepEqual(fixture.summary,{bill_count:3,guests:8,adults:4,children:4,subtotal:350,vat:24.5,service_total:374.5,penalty_total:100,paid_total:474.5,average_bill:158.17});
assert.equal(fixture.daily.length,1);assert.equal(fixture.daily[0].day,'2026-10-19');
assert.equal(fixture.payments.length,3);assert.equal(fixture.payments.find(p=>p.payment_method==='TRANSFER').penalty_total,0);
assert.equal(fixture.packages.find(p=>p.package_name==='Standard ราคาเดิม').paid_total,421);
assert.equal(fixture.packages.find(p=>p.package_name==='แพ็กเกจเดิม').paid_total,53.5);
assert.equal(empty.summary.bill_count,0);assert.equal(empty.summary.paid_total,0);assert.deepEqual(empty.daily,[]);
console.log('PASS: PostgreSQL totals, adult/child aggregation, paid-only scope, Thai midnight boundaries, waived penalties, snapshot names and empty ranges (temporary fixtures rolled back).');
if(process.argv.includes('--sql-only'))process.exit(0);
const base=`http://localhost:${env.APP_PORT||8088}`;let cookie='';
async function request(url){const r=await fetch(base+url,{headers:{Cookie:cookie},redirect:'manual'});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return r;}
(async()=>{
 assert.equal((await request('/api/admin/reports/sales')).status,302);
 const login=await request('/login'),csrf=(await login.text()).match(/name="_csrf"[^>]*value="([^"]+)"/)[1];
 const signed=await fetch(base+'/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:env.ADMIN_USERNAME||'admin',password:env.ADMIN_PASSWORD,_csrf:csrf}),redirect:'manual'});
 assert.equal(signed.status,302);cookie=signed.headers.get('set-cookie').split(';')[0];
 const page=await request('/admin/reports');assert.equal(page.status,200);const html=await page.text();assert(html.includes('/js/reports.js')&&html.includes('/admin/reports'));
 const response=await request('/api/admin/reports/sales'),report=await response.json();assert.equal(response.status,200);assert.equal(report.timezone,'Asia/Bangkok');
 const cents=n=>Math.round(Number(n)*100);
 for(const rows of [report.daily,report.payments,report.packages]){
  assert.equal(rows.reduce((n,r)=>n+Number(r.bill_count),0),Number(report.summary.bill_count));
  assert.equal(rows.reduce((n,r)=>n+cents(r.paid_total),0),cents(report.summary.paid_total));
 }
 for(const params of ['from=2026-10-20&to=2026-10-19','from=2020-01-01&to=2026-10-19','from=bad&to=2026-10-19'])assert.equal((await request('/api/admin/reports/sales?'+params)).status,400);
 console.log('PASS: report page, authenticated API, default period, grouped totals reconciliation and invalid date handling; no application data changed.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
