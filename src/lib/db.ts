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
    console.error('[DB] exec_sql error:', error.message, '\nQuery:', sql.substring(0, 200));
    throw new Error(error.message);
  }
  // exec_sql returns: [{exec_sql: [...]}, ...] or directly [...]
  if (Array.isArray(data) && data.length > 0 && data[0] && 'exec_sql' in data[0]) {
    const rows = data[0].exec_sql;
    return Array.isArray(rows) ? rows : [];
  }
  return Array.isArray(data) ? data : [];
}

/**
 * Execute a mutating SQL statement (INSERT/UPDATE/DELETE).
 * For INSERT ... RETURNING id, returns the first row so lastInsertRowid can be read.
 */
async function execRun(sql: string): Promise<{ lastInsertRowid: string | number }> {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('[DB] exec_sql (run) error:', error.message, '\nQuery:', sql.substring(0, 200));
    throw new Error(error.message);
  }
  // Try to extract the id from RETURNING clause result
  let rows: any[] = [];
  if (Array.isArray(data) && data.length > 0 && data[0] && 'exec_sql' in data[0]) {
    rows = Array.isArray(data[0].exec_sql) ? data[0].exec_sql : [];
  } else if (Array.isArray(data)) {
    rows = data;
  }
  const firstRow = rows[0];
  const rowId = firstRow?.id ?? firstRow?.lastInsertRowid ?? 0;
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
      const sql = formatQuery(query, params);
      try {
        const rows = await execAll(sql);
        console.log(`[DB] all() ${rows.length} rows | ${sql.substring(0, 60)}...`);
        return rows;
      } catch (err: any) {
        console.error('[DB] all() failed:', err.message);
        return [];
      }
    },
    get: async (...params: unknown[]): Promise<any | null> => {
      const sql = formatQuery(query, params);
      try {
        const rows = await execAll(sql);
        const row = rows[0] ?? null;
        console.log(`[DB] get() ${row ? 'found' : 'null'} | ${sql.substring(0, 60)}...`);
        return row;
      } catch (err: any) {
        console.error('[DB] get() failed:', err.message);
        return null;
      }
    },
    run: async (...params: unknown[]): Promise<{ lastInsertRowid: string | number }> => {
      const sql = formatQuery(query.trim(), params);
      try {
        const result = await execRun(sql);
        console.log(`[DB] run() id=${result.lastInsertRowid} | ${sql.substring(0, 100)}...`);
        return result;
      } catch (err: any) {
        console.error('[DB] run() failed:', err.message, '\nSQL:', sql);
        throw err;
      }
    },
  }),
};

export function getDb() {
  return db;
}

export default getDb;
