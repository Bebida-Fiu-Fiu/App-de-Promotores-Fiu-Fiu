ALTER TABLE promotors
ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE promotors
SET role = 'promotor'
WHERE role IS NULL;

ALTER TABLE promotors
ALTER COLUMN role SET NOT NULL;

ALTER TABLE promotors
ADD CONSTRAINT promotors_role_check
CHECK (role IN ('promotor', 'comercial'));
