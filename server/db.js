import pg from 'pg';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const isDbConfigured = Boolean(connectionString);

const pool = isDbConfigured
  ? new Pool({
      connectionString,
      ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
    })
  : null;

export function dbEnabled() {
  return Boolean(pool);
}

export async function ensureUser({ externalAuthId, email = null }) {
  if (!pool) return null;
  const result = await pool.query(
    `insert into users (id, external_auth_id, email, created_at)
     values ($1, $2, $3, now())
     on conflict (external_auth_id)
     do update set email = coalesce(excluded.email, users.email)
     returning id`,
    [randomUUID(), externalAuthId, email]
  );
  return result.rows[0]?.id || null;
}

export async function ensureSession({ sessionId, userId, title }) {
  if (!pool) return null;

  const result = await pool.query(
    `insert into sessions (id, user_id, title, created_at, updated_at)
     values ($1, $2, $3, now(), now())
     on conflict (id) do update
       set updated_at = now(),
           title = case
             when sessions.title is null or sessions.title = '' then excluded.title
             else sessions.title
           end
     where sessions.user_id = excluded.user_id
     returning id, title, created_at, updated_at`,
    [sessionId, userId, title]
  );

  return result.rows[0] || null;
}

export async function appendMessage({ sessionId, userId, role, content, citations = null }) {
  if (!pool) return null;

  const ownership = await pool.query(
    `select 1
     from sessions
     where id = $1 and user_id = $2`,
    [sessionId, userId]
  );
  if (!ownership.rowCount) {
    throw new Error('Session not found for user.');
  }

  const result = await pool.query(
    `insert into messages (id, session_id, role, content, citations, created_at)
     values ($1, $2, $3, $4, $5::jsonb, now())
     returning id, session_id, role, content, citations, created_at`,
    [randomUUID(), sessionId, role, content, citations ? JSON.stringify(citations) : null]
  );

  await pool.query(
    `update sessions
     set updated_at = now()
     where id = $1 and user_id = $2`,
    [sessionId, userId]
  );

  return result.rows[0] || null;
}

export async function getRecentMessages({ sessionId, userId, limit = 10 }) {
  if (!pool) return [];

  const result = await pool.query(
    `select role, content, citations, created_at
     from (
       select m.role, m.content, m.citations, m.created_at
       from messages m
       join sessions s on s.id = m.session_id
       where m.session_id = $1 and s.user_id = $2
       order by m.created_at desc
       limit $3
     ) recent
     order by created_at asc`,
    [sessionId, userId, limit]
  );

  return result.rows;
}

export async function listHistory({ userId, sessionLimit = 40 }) {
  if (!pool) return [];

  const sessionsResult = await pool.query(
    `select id, title, created_at, updated_at
     from sessions
     where user_id = $1
     order by updated_at desc
     limit $2`,
    [userId, sessionLimit]
  );

  const sessions = sessionsResult.rows;
  if (sessions.length === 0) {
    return [];
  }

  const sessionIds = sessions.map((s) => s.id);
  const messagesResult = await pool.query(
    `select id, session_id, role, content, citations, created_at
     from messages
     where session_id = any($1::uuid[])
     order by created_at asc`,
    [sessionIds]
  );

  const bySession = new Map();
  for (const msg of messagesResult.rows) {
    const list = bySession.get(msg.session_id) || [];
    list.push(msg);
    bySession.set(msg.session_id, list);
  }

  return sessions.map((session) => ({
    ...session,
    messages: bySession.get(session.id) || [],
  }));
}
