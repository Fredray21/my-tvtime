-- Drop indexes
DROP INDEX IF EXISTS idx_user_episodes_user_id;
DROP INDEX IF EXISTS idx_user_series_user_id;


-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS user_episodes;
DROP TABLE IF EXISTS user_series;