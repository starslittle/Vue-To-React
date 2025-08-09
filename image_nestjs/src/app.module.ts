import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PromptModule } from './prompt/prompt.module';
import { DocGeneratorModule } from './doc-generator/doc-generator.module';
import { GitImporterModule } from './git-importer/git-importer.module';
import { AgentxModule } from './agentx/agentx.module';
import { VueToReactModule } from './vue-to-react/vue-to-react.module';

@Module({
  imports: [
    AgentxModule,
    DocGeneratorModule,
    GitImporterModule,
    PromptModule,
    VueToReactModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
