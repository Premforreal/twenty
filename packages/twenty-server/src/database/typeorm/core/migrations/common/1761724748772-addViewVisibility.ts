import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddViewVisibility1761724748772 implements MigrationInterface {
  name = 'AddViewVisibility1761724748772';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "core"."view_visibility_enum" AS ENUM('USER', 'WORKSPACE')`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD "visibility" "core"."view_visibility_enum" NOT NULL DEFAULT 'WORKSPACE'`,
    );

    await queryRunner.query(`ALTER TABLE "core"."view" ADD "createdById" uuid`);

    await queryRunner.query(
      `CREATE INDEX "IDX_VIEW_VISIBILITY" ON "core"."view" ("visibility")`,
    );

    await queryRunner.query(
      `ALTER TABLE "core"."view" ADD CONSTRAINT "FK_e3e5907f868f10b24627e4982e4" FOREIGN KEY ("createdById") REFERENCES "core"."userWorkspace"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP CONSTRAINT "FK_e3e5907f868f10b24627e4982e4"`,
    );

    await queryRunner.query(`DROP INDEX "core"."IDX_VIEW_VISIBILITY"`);

    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP COLUMN "createdById"`,
    );
    await queryRunner.query(
      `ALTER TABLE "core"."view" DROP COLUMN "visibility"`,
    );

    await queryRunner.query(`DROP TYPE "core"."view_visibility_enum"`);
  }
}
