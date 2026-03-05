import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/**
 * Escapes a single query parameter for safe interpolation into SQL.
 * Supabase exec_sql does not support $1/$2 parameterized queries, so we
 * interpolate safely here.
 */
function escapeSqlParam(p: unknown): string {
  if (p === null || p === undefined) return 'NULL';
  if (typeof p === 'boolean') return p ? 'TRUE' : 'FALSE';
  if (typeof p === 'number') {
    if (!isFinite(p)) return 'NULL';
    return String(p);
  }
  if (p instanceof Date) return `'${p.toISOString()}'`;
  // String: escape single quotes by doubling them
  return `'${String(p).replace(/'/g, "''")}'`;
}

/**
 * Replace ? placeholders with escaped parameter values.
 */
function formatQuery(query: string, params: unknown[]): string {
  let i = 0;
  return query.replace(/\?/g, () => {
    if (i >= params.length) return 'NULL';
    return escapeSqlParam(params[i++]);
  });
}

/**
 * Execute a SQL query via the exec_sql RPC and return rows as an array.
 */
async function execAll(sql: string): Promise<any[]> {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('[DB] exec_sql (all) error:', error.message, '| SQL:', sql.substring(0, 500));
    throw new Error(`DB_ERROR: ${error.message}`);
  }

  if (!data) return [];

  // Robust parsing of different possible RPC result shapes
  let rows: any[] = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object' && 'exec_sql' in data[0]) {
      // Shape: [{ exec_sql: [row1, row2] }]
      rows = Array.isArray(data[0].exec_sql) ? data[0].exec_sql : [];
    } else {
      // Shape: [row1, row2]
      rows = data;
    }
  } else if (typeof data === 'object') {
    // Shape: { exec_sql: [row1, row2] }
    if ('exec_sql' in data && Array.isArray((data as any).exec_sql)) {
      rows = (data as any).exec_sql;
    } else {
      // Single row object? Wrap in array
      rows = [data];
    }
  }

  return rows;
}

/**
 * Execute a mutating SQL statement (INSERT/UPDATE/DELETE).
 * For INSERT ... RETURNING id, returns the first row so lastInsertRowid can be read.
 */
async function execRun(sql: string): Promise<{ lastInsertRowid: string | number }> {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('[DB] exec_sql (run) error:', error.message, '| SQL:', sql.substring(0, 500));
    throw new Error(`DB_WRITE_ERROR: ${error.message}`);
  }

  let rows: any[] = [];
  if (Array.isArray(data)) {
    if (data.length > 0 && typeof data[0] === 'object' && 'exec_sql' in data[0]) {
      rows = Array.isArray(data[0].exec_sql) ? data[0].exec_sql : [];
    } else {
      rows = data;
    }
  } else if (data && typeof data === 'object') {
    if ('exec_sql' in data && Array.isArray((data as any).exec_sql)) {
      rows = (data as any).exec_sql;
    } else {
      rows = [data];
    }
  }

  const firstRow = rows[0] || {};
  const rowId = firstRow.id ?? firstRow.lastInsertRowid ?? 0;
  return { lastInsertRowid: rowId };
}

/**
 * db.prepare(sql).all(...params)  → returns array of rows
 * db.prepare(sql).get(...params)  → returns first row or null
 * db.prepare(sql).run(...params)  → executes and returns { lastInsertRowid }
 */
export const db = {
  prepare: (query: string) => ({
    all: async (...params: unknown[]): Promise<any[]> => {
      const sql = formatQuery(query.trim(), params);
      try {
        const rows = await execAll(sql);
        console.log(`[DB] all() -> ${rows.length} rows`);
        return rows;
      } catch (err: any) {
        console.error('[DB] all() exception:', err.message);
        throw err; // DO NOT SWALLOW
      }
    },
    get: async (...params: unknown[]): Promise<any | null> => {
      const sql = formatQuery(query.trim(), params);
      try {
        const rows = await execAll(sql);
        const row = rows[0] ?? null;
        console.log(`[DB] get() -> ${row ? 'row found' : 'null'}`);
        return row;
      } catch (err: any) {
        console.error('[DB] get() exception:', err.message);
        throw err; // DO NOT SWALLOW
      }
    },
    run: async (...params: unknown[]): Promise<{ lastInsertRowid: string | number }> => {
      const sql = formatQuery(query.trim(), params);
      try {
        const result = await execRun(sql);
        console.log(`[DB] run() -> success (id: ${result.lastInsertRowid})`);
        return result;
      } catch (err: any) {
        console.error('[DB] run() exception:', err.message);
        throw err;
      }
    },
  }),
};

export function getDb() {
  return db;
}

export default getDb;
