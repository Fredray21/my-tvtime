-- Drop indexes
DROP INDEX IF EXISTS idx_user_movies_user_id;

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS user_movies;
DROP TABLE IF EXISTS users;

-- Disable UUID extension (Optional)
DROP EXTENSION IF EXISTS "pgcrypto";