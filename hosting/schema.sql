CREATE TABLE IF NOT EXISTS calendar_entries (
    user_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    entry_date DATE NOT NULL,
    notes TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calendar_attachments (
    id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    user_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    entry_date DATE NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    file_size INT UNSIGNED NOT NULL,
    file_data LONGBLOB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY calendar_attachments_entry (user_id, entry_date),
    CONSTRAINT calendar_attachments_entry_fk
        FOREIGN KEY (user_id, entry_date)
        REFERENCES calendar_entries (user_id, entry_date)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS calendar_attachment_captions (
    attachment_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    caption VARCHAR(2000) NOT NULL DEFAULT '',
    PRIMARY KEY (attachment_id),
    CONSTRAINT calendar_attachment_captions_attachment_fk
        FOREIGN KEY (attachment_id)
        REFERENCES calendar_attachments (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE calendar_entries
SET notes = '[]'
WHERE TRIM(notes) NOT LIKE '[%';
