import pg from "pg";
import { sampleParcels, sourceRecords } from "./seed.js";
if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL must be configured");
const url = new URL(process.env.DATABASE_URL);
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 15000,
  ssl:
    url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? false
      : { rejectUnauthorized: true },
});
pool.on("error", () => console.error("Database connection interrupted"));
export async function initialize() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(26014001)");
    await c.query(`CREATE SCHEMA IF NOT EXISTS bhoomi;
 CREATE TABLE IF NOT EXISTS bhoomi.users(id UUID PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password_hash TEXT,role TEXT NOT NULL CHECK(role IN ('citizen','officer')),demo BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS bhoomi.sessions(token_hash TEXT PRIMARY KEY,user_id UUID REFERENCES bhoomi.users(id),expires_at TIMESTAMPTZ NOT NULL);
 CREATE TABLE IF NOT EXISTS bhoomi.parcels(id TEXT PRIMARY KEY,data JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS bhoomi.applications(id TEXT PRIMARY KEY,parcel_id TEXT REFERENCES bhoomi.parcels(id),user_id UUID REFERENCES bhoomi.users(id),service TEXT NOT NULL,requested_area NUMERIC,details TEXT NOT NULL,status TEXT NOT NULL,reason TEXT,parcel_version INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
 CREATE INDEX IF NOT EXISTS applications_user_idx ON bhoomi.applications(user_id);
 CREATE TABLE IF NOT EXISTS bhoomi.audit(id BIGSERIAL PRIMARY KEY,application_id TEXT REFERENCES bhoomi.applications(id),parcel_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT now());`);
    await c.query(`ALTER TABLE bhoomi.users ADD COLUMN IF NOT EXISTS department TEXT;
 ALTER TABLE bhoomi.users ADD COLUMN IF NOT EXISTS jurisdiction TEXT DEFAULT 'ALL';
 ALTER TABLE bhoomi.applications ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}';
 ALTER TABLE bhoomi.applications ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ DEFAULT (now()+interval '3 days');
 ALTER TABLE bhoomi.applications ADD COLUMN IF NOT EXISTS assigned_department TEXT DEFAULT 'revenue';
 CREATE TABLE IF NOT EXISTS bhoomi.tasks(id BIGSERIAL PRIMARY KEY,application_id TEXT REFERENCES bhoomi.applications(id),stage INTEGER NOT NULL,department TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Waiting',reason TEXT,actor TEXT,completed_at TIMESTAMPTZ,UNIQUE(application_id,stage));
 CREATE TABLE IF NOT EXISTS bhoomi.notifications(id BIGSERIAL PRIMARY KEY,user_id UUID REFERENCES bhoomi.users(id),application_id TEXT REFERENCES bhoomi.applications(id),title TEXT NOT NULL,message TEXT NOT NULL,read BOOLEAN NOT NULL DEFAULT false,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS bhoomi.integration_events(id BIGSERIAL PRIMARY KEY,event_key TEXT UNIQUE NOT NULL,application_id TEXT REFERENCES bhoomi.applications(id),parcel_id TEXT NOT NULL,department TEXT NOT NULL,payload JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',attempts INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TIMESTAMPTZ DEFAULT now(),delivered_at TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS bhoomi.source_records(id TEXT PRIMARY KEY,parcel_id TEXT REFERENCES bhoomi.parcels(id),domain TEXT NOT NULL,department TEXT NOT NULL,source TEXT NOT NULL,record_values JSONB NOT NULL,updated_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS bhoomi.import_batches(id UUID PRIMARY KEY,user_id UUID REFERENCES bhoomi.users(id),source TEXT NOT NULL,state TEXT NOT NULL,count INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS bhoomi.bookmarks(user_id UUID REFERENCES bhoomi.users(id),parcel_id TEXT REFERENCES bhoomi.parcels(id),created_at TIMESTAMPTZ DEFAULT now(),PRIMARY KEY(user_id,parcel_id));
 CREATE INDEX IF NOT EXISTS tasks_application_idx ON bhoomi.tasks(application_id);
 CREATE INDEX IF NOT EXISTS notifications_user_idx ON bhoomi.notifications(user_id);
 CREATE INDEX IF NOT EXISTS source_records_parcel_idx ON bhoomi.source_records(parcel_id);
 CREATE INDEX IF NOT EXISTS parcels_state_idx ON bhoomi.parcels((data->>'state'));
 UPDATE bhoomi.parcels SET data=data || '{"state":"KA","state_name":"Karnataka","source":"Bhoomi synthetic pilot","valuation_rate":2000}'::jsonb WHERE NOT data ? 'state';
 INSERT INTO bhoomi.tasks(application_id,stage,department,status) SELECT id,0,'revenue',CASE WHEN status IN ('Approved','Rejected') THEN status ELSE 'Pending' END FROM bhoomi.applications WHERE NOT EXISTS(SELECT 1 FROM bhoomi.tasks t WHERE t.application_id=applications.id);`);
    await c.query(
      "INSERT INTO bhoomi.parcels(id,data) SELECT id,data FROM jsonb_to_recordset($1::jsonb) AS p(id text,data jsonb) ON CONFLICT DO NOTHING",
      [JSON.stringify(sampleParcels().map((p) => ({ id: p.id, data: p })))],
    );
    const current = await c.query(
      "SELECT data FROM bhoomi.parcels ORDER BY id",
    );
    const sources = current.rows
      .flatMap((r, i) => sourceRecords(r.data, i))
      .map(({ values, ...r }) => ({ ...r, record_values: values }));
    await c.query(
      "INSERT INTO bhoomi.source_records(id,parcel_id,domain,department,source,record_values,updated_at) SELECT id,parcel_id,domain,department,source,record_values,updated_at::timestamptz FROM jsonb_to_recordset($1::jsonb) AS s(id text,parcel_id text,domain text,department text,source text,record_values jsonb,updated_at text) ON CONFLICT DO NOTHING",
      [JSON.stringify(sources)],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
