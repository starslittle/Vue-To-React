import { Module } from '@nestjs/common';
import { VueToReactController } from './vue-to-react.controller';
import { VueToReactService } from './vue-to-react.service';

@Module({
  controllers: [VueToReactController],
  providers: [VueToReactService],
})
export class VueToReactModule {} 