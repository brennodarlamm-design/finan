// api/_database.js — fronteira explícita entre runtime tenant e acesso privilegiado.
//
// DATABASE_URL: conexão de runtime com role NOBYPASSRLS (finobra_app).
// DATABASE_OWNER_URL: conexão privilegiada, usada apenas em bootstrap/auth/admin/jobs globais.

import { neon } from '@neondatabase/serverless';

function env(name) {
  return String(process.env[name] || '').trim();
}

function roleFromConnectionString(conn) {
  try {
    return decodeURIComponent(new URL(conn).username || '').trim();
  } catch {
    return '';
  }
}

export function getRuntimeDatabaseUrl() {
  const conn = env('DATABASE_URL');
  if (!conn) throw new Error('DATABASE_URL não configurada para o runtime tenant.');

  const role = roleFromConnectionString(conn).toLowerCase();
  if (role === 'neondb_owner' || role.endsWith('_owner')) {
    throw new Error('DATABASE_URL não pode usar role owner/BYPASSRLS; configure o runtime com finobra_app.');
  }
  return conn;
}

export function createRuntimeSql() {
  return neon(getRuntimeDatabaseUrl());
}

export function getOwnerDatabaseUrl() {
  const conn = env('DATABASE_OWNER_URL');
  if (!conn) throw new Error('DATABASE_OWNER_URL não configurada para operação privilegiada.');
  return conn;
}

export function createOwnerSql() {
  return neon(getOwnerDatabaseUrl());
}
