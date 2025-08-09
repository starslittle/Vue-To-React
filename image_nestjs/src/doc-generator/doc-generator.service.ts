import { Injectable } from '@nestjs/common';
import * as path from 'path';

@Injectable()
export class DocGeneratorService {
  async generateDocFromUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const codeContent = await response.text();
      const filename = path.basename(new URL(url).pathname);

      return `// File: ${filename}\n\n${codeContent}`;
    } catch (error) {
      console.error('Error fetching from URL:', error);
      throw new Error('Could not retrieve content from the provided URL.');
    }
  }
}
