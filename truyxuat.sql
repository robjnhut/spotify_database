SELECT table_name FROM user_tables;
SELECT object_name FROM user_objects WHERE object_type = 'PROCEDURE';

SELECT trigger_name FROM user_triggers;

SELECT * FROM favorites;
SELECT * FROM favorites_log;

SELECT id, name, artist, preview_url, image_url FROM favorites;