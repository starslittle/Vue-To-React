import {
  Controller,
  Post,
  Body,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { DocGeneratorService } from './doc-generator.service';

class GenerateDocDto {
  url: string;
}

@Controller('doc-generator')
export class DocGeneratorController {
  constructor(private readonly docGeneratorService: DocGeneratorService) {}

  @Post('from-url')
  @HttpCode(200)
  async generateDoc(
    @Body() createDocDto: GenerateDocDto,
  ): Promise<{ document: string }> {
    if (!createDocDto.url) {
      throw new BadRequestException('URL is required.');
    }

    try {
      const document = await this.docGeneratorService.generateDocFromUrl(
        createDocDto.url,
      );
      return { document };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
