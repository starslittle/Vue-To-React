import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFiles,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { VueToReactService } from './vue-to-react.service';
import { Response } from 'express';

@Controller('api/vue-to-react')
export class VueToReactController {
  constructor(private readonly vueToReactService: VueToReactService) {}

  @Post('convert')
  async convert(@Body('filePathOrUrl') filePathOrUrl: string) {
    return this.vueToReactService.convertVueToReact(filePathOrUrl);
  }

  @Post('upload-project')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadProject(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body('rootDir') rootDir: string,
    @Res() res: Response,
  ) {
    const zipStream = await this.vueToReactService.handleUploadedProject(
      files,
      rootDir,
    );

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${rootDir || 'react-project'}_react.zip`,
    );

    zipStream.pipe(res);
  }
} 