import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// Compatibility wrapper for the rest of the app
export const db = {
  prepare: (query: string) => ({
    all: async (...params: any[]) => {
      try {
        const sql_query = formatQuery(query, params);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query });
        if (error) {
          console.error("RPC [all] Error:", error.message, "| Query:", sql_query);
          return [];
        }
        // Handle cases where RPC returns [{exec_sql: [...]}] or just [...]
        let rows = data;
        if (Array.isArray(data) && data[0] && 'exec_sql' in data[0]) {
          rows = data[0].exec_sql || [];
        }
        return Array.isArray(rows) ? rows : [];
      } catch (err: any) {
        console.error("DB [all] Exception:", err.message);
        return [];
      }
    },
    get: async (...params: any[]) => {
      try {
        const sql_query = formatQuery(query, params);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query });
        if (error) {
          console.error("RPC [get] Error:", error.message, "| Query:", sql_query);
          return null;
        }
        let rows = data;
        if (Array.isArray(data) && data[0] && 'exec_sql' in data[0]) {
          rows = data[0].exec_sql || [];
        }
        return (Array.isArray(rows) && rows.length > 0) ? rows[0] : null;
      } catch (err: any) {
        console.error("DB [get] Exception:", err.message);
        return null;
      }
    },
    run: async (...params: any[]) => {
      try {
        const sql_query = formatQuery(query, params);
        const { data, error } = await supabase.rpc('exec_sql', { sql_query });
        if (error) {
          console.error("RPC [run] Error:", error.message, "| Query:", sql_query);
          throw error;
        }
        let rows = data;
        if (Array.isArray(data) && data[0] && 'exec_sql' in data[0]) {
          rows = data[0].exec_sql || [];
        }
        // Return id from RETURNING clause if present
        const result = (Array.isArray(rows) && rows.length > 0) ? rows[0] : {};
        return { lastInsertRowid: result.id || 0 };
      } catch (err: any) {
        console.error("DB [run] Exception:", err.message);
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
