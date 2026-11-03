-- The "editor" role becomes "editorial board": the same editing powers, under the name the Journal uses.
ALTER TYPE "public"."member_role" RENAME VALUE 'editor' TO 'editorial_board';
