import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

/**
 * 🛠️ INDUSTRIAL DATABASE WRAPPER
 * Optimized for Supabase RPC 'exec_sql' bridge.
 */
export const db = {
  prepare: (query: string) => ({
    all: async (...params: any[]) => {
      try {
        const sql_query = formatQuery(query, params);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query });
        if (error) {
          console.error("[DB] RPC [all] Error:", error, "| Query:", sql_query);
          return [];
        }

        let rows = data;
        if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object' && 'exec_sql' in data[0]) {
          rows = data[0].exec_sql;
        }

        const arr = Array.isArray(rows) ? rows : [];
        console.log(`[DB] all() -> query: ${sql_query.substring(0, 50)}... | result: ${arr.length} rows`);
        return arr;
      } catch (err: any) {
        console.error("[DB] all() Exception:", err.message);
        return [];
      }
    },
    get: async (...params: any[]) => {
      try {
        const sql_query = formatQuery(query, params);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query });
        if (error) {
          console.error("[DB] RPC [get] Error:", error, "| Query:", sql_query);
          return null;
        }

        let rows = data;
        if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object' && 'exec_sql' in data[0]) {
          rows = data[0].exec_sql;
        }

        const result = (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;
        console.log(`[DB] get() -> query: ${sql_query.substring(0, 50)}... | result: ${result ? 'FOUND' : 'NULL'}`);
        return result;
      } catch (err: any) {
        console.error("[DB] get() Exception:", err.message);
        return null;
      }
    },
    run: async (...params: any[]) => {
      try {
        const sql_query = formatQuery(query, params);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query });
        if (error) {
          console.error("[DB] RPC [run] Error:", error, "| Query:", sql_query);
          throw error;
        }

        let rows = data;
        if (Array.isArray(data) && data.length === 1 && data[0] && typeof data[0] === 'object' && 'exec_sql' in data[0]) {
          rows = data[0].exec_sql;
        }

        const result = (Array.isArray(rows) && rows.length > 0) ? rows[0] : {};
        console.log(`[DB] run() -> query: ${sql_query.substring(0, 50)}... | result id: ${result.id || 0}`);
        return { lastInsertRowid: result.id || 0 };
      } catch (err: any) {
        console.error("[DB] run() Exception:", err.message);
        throw err;
      }
    }
  })
};

function formatQuery(query: string, params: any[]) {
  let i = 0;
  return query.replace(/\?/g, () => {
    const p = params[i++];
    if (typeof p === 'string') return `'${p.replace(/'/g, "''")}'`;
    if (p === null || p === undefined) return 'NULL';
    if (typeof p === 'boolean') return p ? 'TRUE' : 'FALSE';
    return p;
  });
}

export function getDb() {
  return db;
}

export default getDb;
