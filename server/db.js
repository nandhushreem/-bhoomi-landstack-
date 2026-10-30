import pg from 'pg';
import {sampleParcels} from './seed.js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL must be configured');
const url=new URL(process.env.DATABASE_URL);
export const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:15000,ssl:url.hostname==='localhost'||url.hostname==='127.0.0.1'?false:{rejectUnauthorized:true}});
pool.on('error',()=>console.error('Database connection interrupted'));
export async function initialize(){
 const c=await pool.connect();
 try{
 await c.query('BEGIN');
 await c.query("SELECT pg_advisory_xact_lock(26014001)");
 await c.query(`CREATE SCHEMA IF NOT EXISTS bhoomi;
 CREATE TABLE IF NOT EXISTS bhoomi.users(id UUID PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password_hash TEXT,role TEXT NOT NULL CHECK(role IN ('citizen','officer')),demo BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ DEFAULT now());
 CREATE TABLE IF NOT EXISTS bhoomi.sessions(token_hash TEXT PRIMARY KEY,user_id UUID REFERENCES bhoomi.users(id),expires_at TIMESTAMPTZ NOT NULL);
 CREATE TABLE IF NOT EXISTS bhoomi.parcels(id TEXT PRIMARY KEY,data JSONB NOT NULL);
 CREATE TABLE IF NOT EXISTS bhoomi.applications(id TEXT PRIMARY KEY,parcel_id TEXT REFERENCES bhoomi.parcels(id),user_id UUID REFERENCES bhoomi.users(id),service TEXT NOT NULL,requested_area NUMERIC,details TEXT NOT NULL,status TEXT NOT NULL,reason TEXT,parcel_version INTEGER NOT NULL,created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now());
 CREATE INDEX IF NOT EXISTS applications_user_idx ON bhoomi.applications(user_id);
 CREATE TABLE IF NOT EXISTS bhoomi.audit(id BIGSERIAL PRIMARY KEY,application_id TEXT REFERENCES bhoomi.applications(id),parcel_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail JSONB NOT NULL,created_at TIMESTAMPTZ DEFAULT now());`);
 for(const p of sampleParcels())await c.query('INSERT INTO bhoomi.parcels(id,data) VALUES($1,$2) ON CONFLICT DO NOTHING',[p.id,p]);
 await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
