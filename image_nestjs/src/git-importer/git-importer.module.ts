import { Module } from '@nestjs/common';
import { GitImporterController } from './git-importer.controller';
import { GitImporterService } from './git-importer.service';

@Module({
  controllers: [GitImporterController],
  providers: [GitImporterService],
})
export class GitImporterModule {}
