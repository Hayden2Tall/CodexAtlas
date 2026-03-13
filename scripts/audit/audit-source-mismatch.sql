-- Audit: Passages with standard/AI transcription methods on non-edition manuscripts
-- Run this in the Supabase SQL editor to quantify data integrity issues.
--
-- These are passages where the stored text came from a standard critical edition
-- (SBLGNT, WLC, LXX, TR) or AI generation but is attributed to a specific manuscript
-- that is NOT itself a standard edition. The text does not represent that manuscript.
--
-- Results should be reviewed before triggering batch re-imports.

SELECT
  p.id                    AS passage_id,
  p.reference,
  p.transcription_method,
  m.title                 AS manuscript_title,
  m.original_language,
  p.metadata->>'ingested_by'            AS ingested_by,
  p.metadata->>'edition_source'         AS edition_source,
  p.metadata->>'transcription_source'   AS transcription_source,
  p.created_at
FROM passages p
JOIN manuscripts m ON m.id = p.manuscript_id
WHERE p.transcription_method IN ('standard_edition', 'ai_reconstructed', 'ai_imported')
  AND LOWER(m.title) NOT IN (
    'sblgnt',
    'sbl greek new testament',
    'westminster leningrad codex',
    'codex leningradensis',
    'leningrad codex',
    'firkovich b 19a',
    'leningradensis',
    'lxx',
    'septuagint',
    'textus receptus',
    'byzantine text',
    'open scriptures hebrew bible',
    'oshb',
    'tyndale house gnt',
    'thgnt'
  )
ORDER BY m.title, p.reference;

-- Summary count by manuscript
SELECT
  m.title                 AS manuscript_title,
  p.transcription_method,
  COUNT(*)                AS passage_count
FROM passages p
JOIN manuscripts m ON m.id = p.manuscript_id
WHERE p.transcription_method IN ('standard_edition', 'ai_reconstructed', 'ai_imported')
  AND LOWER(m.title) NOT IN (
    'sblgnt', 'sbl greek new testament',
    'westminster leningrad codex', 'codex leningradensis',
    'leningrad codex', 'firkovich b 19a', 'leningradensis',
    'lxx', 'septuagint', 'textus receptus', 'byzantine text',
    'open scriptures hebrew bible', 'oshb',
    'tyndale house gnt', 'thgnt'
  )
GROUP BY m.title, p.transcription_method
ORDER BY passage_count DESC, m.title;
