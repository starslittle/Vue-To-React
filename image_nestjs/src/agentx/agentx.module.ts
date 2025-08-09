import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AgentxController } from './agentx.controller';
import { AgentxService } from './agentx.service';

@Module({
  imports: [HttpModule],
  controllers: [AgentxController],
  providers: [AgentxService],
})
export class AgentxModule {} 