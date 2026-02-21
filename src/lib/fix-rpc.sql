-- Robust exec_sql that handles SELECT, DML with RETURNING, and regular DML.
-- Uses a CTE to capture results from RETURNING statements.
CREATE OR REPLACE FUNCTION exec_sql(sql_query text)
RETURNS jsonB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    cleaned_query text;
BEGIN
    cleaned_query := trim(trailing ';' from trim(sql_query));
    
    -- If it's a SELECT or has a RETURNING clause, we use the CTE approach to get results.
    IF lower(cleaned_query) ~ '^select' OR cleaned_query ilike '%returning%' THEN
        EXECUTE 'WITH result_set AS (' || cleaned_query || ') SELECT jsonb_agg(t) FROM result_set t' INTO result;
    ELSE
        -- For regular INSERT/UPDATE/DELETE without RETURNING, just execute.
        EXECUTE cleaned_query;
        result := '[]'::jsonb;
    END IF;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
