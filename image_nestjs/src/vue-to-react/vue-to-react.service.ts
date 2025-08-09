import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as archiver from 'archiver';
import { Stream } from 'stream';

@Injectable()
export class VueToReactService {
  async convertVueToReact(filePathOrUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Note: The script path is now relative to the project root where the NestJS app is executed.
      const scriptPath = path.resolve(
        process.cwd(),
        'process_vue_to_react.ps1',
      );

      const powershell = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        filePathOrUrl,
      ]);

      let output = '';
      let errorOutput = '';

      powershell.stdout.on('data', (data) => {
        const decoded = data.toString('utf8');
        console.log('PowerShell stdout:', decoded);
        output += decoded;
      });

      powershell.stderr.on('data', (data) => {
        const decoded = data.toString('utf8');
        console.error('PowerShell stderr:', decoded);
        errorOutput += decoded;
      });

      powershell.on('close', (code) => {
        if (code === 0) {
          resolve(output || 'Script executed successfully, but produced no output.');
        } else {
          reject(
            new Error(`PowerShell script exited with code ${code}. Error: ${errorOutput}`),
          );
        }
      });

      powershell.on('error', (err) => {
        console.error('Failed to start PowerShell:', err);
        reject(new Error(`Failed to start PowerShell: ${err.message}`));
      });
    });
  }

  private async runPowerShellScript(
    projectPath: string,
    destinationPath: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(
        process.cwd(),
        '..',
        'process_vue_to_react.ps1',
      );

      const powershell = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        projectPath,
        destinationPath,
      ]);

      let output = '';
      let errorOutput = '';

      powershell.stdout.on('data', (data) => {
        const decoded = data.toString('utf8');
        console.log('PowerShell stdout:', decoded);
        output += decoded;
      });

      powershell.stderr.on('data', (data) => {
        const decoded = data.toString('utf8');
        console.error('PowerShell stderr:', decoded);
        errorOutput += decoded;
      });

      powershell.on('close', (code) => {
        if (code === 0) {
          resolve(
            output || 'Script executed successfully, but produced no output.',
          );
        } else {
          reject(
            new Error(
              `PowerShell script exited with code ${code}. Error: ${errorOutput}`,
            ),
          );
        }
      });

      powershell.on('error', (err) => {
        console.error('Failed to start PowerShell:', err);
        reject(new Error(`Failed to start PowerShell: ${err.message}`));
      });
    });
  }

  async handleUploadedProject(
    files: Array<Express.Multer.File>,
    rootDir: string,
  ): Promise<Stream> {
    if (!files || files.length === 0) {
      throw new NotFoundException('No files uploaded.');
    }

    // Create a temporary directory to store the uploaded project
    const tempDir = path.join(os.tmpdir(), 'vue-projects', Date.now().toString());
    const projectPath = path.join(tempDir, rootDir);
    await fs.ensureDir(projectPath);

    try {
      // Save the uploaded files to the temporary directory
      for (const file of files) {
        const filePath = path.join(tempDir, file.originalname);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.buffer);
      }

      const generatedProjectDir = `${projectPath}_react`;

      // Run the conversion script
      await this.runPowerShellScript(projectPath, generatedProjectDir);

      // Check if the generated project directory exists
      if (!(await fs.pathExists(generatedProjectDir))) {
        throw new InternalServerErrorException(
          'The conversion script did not generate the React project directory as expected.',
        );
      }

      // Create a zip stream of the generated React project
      const zipStream = archiver('zip', {
        zlib: { level: 9 }, // Sets the compression level.
      });

      zipStream.directory(generatedProjectDir, false);

      // Finalize the archive and the stream will be piped to the response in the controller
      zipStream.finalize();

      // Clean up the temporary directories after the stream is read
      zipStream.on('end', async () => {
        await fs.remove(tempDir);
        await fs.remove(generatedProjectDir); // Also remove the generated project
      });
      zipStream.on('error', async (err) => {
        console.error('Error during zip streaming, cleaning up temp files.', err);
        await fs.remove(tempDir);
        await fs.remove(generatedProjectDir);
      });

      return zipStream;
    } catch (error) {
      // Clean up the temporary directory in case of an error
      await fs.remove(tempDir);
      throw new InternalServerErrorException(
        `Failed to process project: ${error.message}`,
      );
    }
  }
} 