-- Enable RLS (if not already) and add safe policies for reviews

-- NOTE: Adjust table/column names if they differ in your schema

-- Ensure RLS is on
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies to avoid duplicates (optional, safe if named policies don't exist)
DO $$ BEGIN
    PERFORM 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'Allow public read reviews';
    IF FOUND THEN EXECUTE 'DROP POLICY "Allow public read reviews" ON reviews;'; END IF;
END $$;

DO $$ BEGIN
    PERFORM 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'Allow anon/auth insert reviews';
    IF FOUND THEN EXECUTE 'DROP POLICY "Allow anon/auth insert reviews" ON reviews;'; END IF;
END $$;

-- READ: anyone can read reviews
CREATE POLICY "Allow public read reviews"
ON reviews
FOR SELECT
USING (true);

-- INSERT: allow anon and authenticated to write reviews with basic validation
-- Validation examples:
--  - rating between 1 and 5
--  - comment length limited
--  - product exists
CREATE POLICY "Allow anon/auth insert reviews"
ON reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
    (rating >= 1 AND rating <= 5)
    AND (char_length(comment) <= 2000)
    AND EXISTS (
        SELECT 1 FROM products p WHERE p.id = reviews.product_id
    )
);

-- Optional: If you store user_id via auth.uid(), allow setting user_id null or equal to current user
-- If your schema includes user_id, you might want:
-- ALTER TABLE reviews ALTER COLUMN user_id DROP NOT NULL;
-- And add this invariant in WITH CHECK:
-- (user_id IS NULL OR user_id = auth.uid())


