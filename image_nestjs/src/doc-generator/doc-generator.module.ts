import { Module } from '@nestjs/common';
import { DocGeneratorController } from './doc-generator.controller';
import { DocGeneratorService } from './doc-generator.service';

@Module({
  controllers: [DocGeneratorController],
  providers: [DocGeneratorService],
})
export class DocGeneratorModule {}
