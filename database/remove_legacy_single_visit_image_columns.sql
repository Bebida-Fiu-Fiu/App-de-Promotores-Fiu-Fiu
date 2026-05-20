ALTER TABLE visits
ADD COLUMN IF NOT EXISTS before_images JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE visits
ADD COLUMN IF NOT EXISTS after_images JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'visits'
      AND column_name = 'before_image'
  ) THEN
    EXECUTE $sql$
      UPDATE visits
      SET before_images = CASE
        WHEN before_image IS NOT NULL
          AND before_image <> ''
          AND before_images = '[]'::jsonb
        THEN jsonb_build_array(before_image)
        ELSE before_images
      END
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'visits'
      AND column_name = 'after_image'
  ) THEN
    EXECUTE $sql$
      UPDATE visits
      SET after_images = CASE
        WHEN after_image IS NOT NULL
          AND after_image <> ''
          AND after_images = '[]'::jsonb
        THEN jsonb_build_array(after_image)
        ELSE after_images
      END
    $sql$;
  END IF;
END $$;

ALTER TABLE visits
DROP COLUMN IF EXISTS before_image;

ALTER TABLE visits
DROP COLUMN IF EXISTS after_image;
