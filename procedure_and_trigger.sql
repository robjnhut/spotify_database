CREATE TABLE favorites (
    id VARCHAR2(100) PRIMARY KEY,
    name VARCHAR2(255) NOT NULL,
    artist VARCHAR2(255) NOT NULL,
    preview_url VARCHAR2(500),
    image_url VARCHAR2(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE PROCEDURE ADD_FAVORITE (
    p_id IN VARCHAR2,
    p_name IN VARCHAR2,
    p_artist IN VARCHAR2,
    p_preview_url IN VARCHAR2,
    p_image_url IN VARCHAR2
)
AS
BEGIN
    INSERT INTO favorites (id, name, artist, preview_url, image_url)
    VALUES (p_id, p_name, p_artist, p_preview_url, p_image_url);
    COMMIT;
EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
        UPDATE favorites
        SET name = p_name,
            artist = p_artist,
            preview_url = p_preview_url,
            image_url = p_image_url
        WHERE id = p_id;
        COMMIT;
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE;
END;
/


CREATE OR REPLACE TRIGGER LOG_FAVORITES_CHANGES
AFTER INSERT OR DELETE ON favorites
FOR EACH ROW
BEGIN
    IF INSERTING THEN
        INSERT INTO favorites_log (action, track_id, track_name)
        VALUES ('INSERT', :NEW.id, :NEW.name);
    ELSIF DELETING THEN
        INSERT INTO favorites_log (action, track_id, track_name)
        VALUES ('DELETE', :OLD.id, :OLD.name);
    END IF;
END;
/


