-- =====================================================
-- Simple Database Schema Report
-- =====================================================
-- Run this in Supabase SQL Editor for a clean summary
-- =====================================================

-- All Tables
SELECT 
    'TABLE' as type,
    table_schema as schema_name,
    table_name as name,
    NULL as details
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- Detailed Column Information (Main Query)
-- =====================================================
SELECT 
    t.table_name AS "Table",
    c.column_name AS "Column",
    c.data_type AS "Type",
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        ELSE c.data_type
    END AS "Full Type",
    c.is_nullable AS "Nullable",
    c.column_default AS "Default",
    CASE 
        WHEN pk.column_name IS NOT NULL THEN 'PK'
        WHEN fk.column_name IS NOT NULL THEN 'FK → ' || fk.foreign_table_name || '.' || fk.foreign_column_name
        ELSE ''
    END AS "Key Info"
FROM information_schema.tables t
INNER JOIN information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
LEFT JOIN (
    SELECT 
        ku.table_schema,
        ku.table_name,
        ku.column_name
    FROM information_schema.table_constraints tc
    INNER JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk 
    ON c.table_name = pk.table_name 
    AND c.table_schema = pk.table_schema
    AND c.column_name = pk.column_name
LEFT JOIN (
    SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk
    ON c.table_name = fk.table_name
    AND c.table_schema = fk.table_schema
    AND c.column_name = fk.column_name
WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name, c.ordinal_position;

