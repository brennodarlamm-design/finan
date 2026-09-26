// api/_database.js — fronteira explícita entre runtime tenant e acesso privilegiado.
//
// DATABASE_URL: conexão de runtime com role NOBYPASSRLS (finobra_app).
// DATABASE_OWNER_URL: conexão privilegiada, usada apenas em bootstrap/auth/admin/jobs globais.

import { neon } from '@neondatabase/serverless';
import { createResilientNeon } from './_neon-resilience.js';

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

export function createRuntimeSql(options = {}) {
  return createResilientNeon(getRuntimeDatabaseUrl(), options);
}

export function getOwnerDatabaseUrl() {
  const conn = env('DATABASE_OWNER_URL');
  if (conn) return conn;

  const fallback = env('DATABASE_URL');
  if (fallback) {
    const role = roleFromConnectionString(fallback).toLowerCase();
    if (role === 'neondb_owner' || role.endsWith('_owner')) {
      return fallback;
    }
  }

  throw new Error('DATABASE_OWNER_URL não configurada para operação privilegiada.');
}

export function createOwnerSql(options = {}) {
  return createResilientNeon(getOwnerDatabaseUrl(), options);
}
