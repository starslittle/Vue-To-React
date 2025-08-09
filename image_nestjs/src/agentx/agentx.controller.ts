import { Controller, Post } from '@nestjs/common';
import { AgentxService } from './agentx.service';

@Controller('agentx')
export class AgentxController {
  constructor(private readonly agentxService: AgentxService) {}

  @Post('process-prompt')
  async processPrompt() {
    return this.agentxService.processPromptFile();
  }
}
