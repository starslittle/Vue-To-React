import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Header,
} from '@nestjs/common';
import { GitImporterService } from './git-importer.service';

@Controller('git')
export class GitImporterController {
  constructor(private readonly gitImporterService: GitImporterService) {}

  @Post('import-local-project')
  @Header('Content-Type', 'text/plain')
  async importLocalProject(@Body('localPath') localPath: string) {
    if (!localPath) {
      throw new BadRequestException('Missing localPath in request body');
    }
    // Directly return the text content from the service
    return this.gitImporterService.importLocalProject(localPath);
  }

  @Post('clone-repo')
  @Header('Content-Type', 'text/plain')
  async cloneRepo(@Body('repoUrl') repoUrl: string) {
    if (!repoUrl) {
      throw new BadRequestException('Missing repoUrl in request body');
    }
    // Directly return the text content from the service
    return this.gitImporterService.cloneAndReadRepo(repoUrl);
  }
}
