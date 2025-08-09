const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execPromise = promisify(exec);

const app = express();
app.use(express.json()); // Enable JSON body parsing
const PORT = 3001;

// The base output directory is the parent 'image' directory
const BASE_OUTPUT_DIR = path.join(__dirname, '..');

/**
 * Parses the content of a project definition file into a list of file objects.
 * Assumes files are separated by a delimiter like "// File: path/to/file.ext".
 * @param {string} content - The content of the project file.
 * @returns {Array<{path: string, content: string}>} - A list of file objects.
 */
function parseProjectFile(content) {
  const files = [];
  const fileDelimiter = '// File: ';
  
  // Split the content by the delimiter to get individual file blocks
  const blocks = content.split(fileDelimiter).slice(1);

  for (const block of blocks) {
    const lines = block.split('\n');
    const filePath = lines[0].trim();
    const fileContentLines = lines.slice(1);

    // Filter out lines that are just markdown code block delimiters
    const filteredFileContent = fileContentLines.filter(line => {
      const trimmedLine = line.trim();
      return !trimmedLine.startsWith('```');
    }).join('\n');

    if (filePath) {
      files.push({
        path: filePath,
        content: filteredFileContent.trim()
      });
    }
  }

  return files;
}

/**
 * Generates a project structure from a source definition file.
 * The generated project will be placed in a new directory named after the source file
 * (e.g., "news-disclaimer.txt" -> "image/news-disclaimer-react/").
 * @param {string} sourceFilePath - The absolute path to the source definition file.
 * @param {string} projectName - The desired name for the output project directory.
 * @param {string} [outputDir] - Optional. The absolute path for the output directory.
 */
async function generateProject(sourceFilePath, projectName, outputDir) {
  console.log(`Reading source file: ${sourceFilePath}...`);
  let fileContent;
  try {
    fileContent = await fs.readFile(sourceFilePath, 'utf8');
  } catch (error) {
    console.error(`Error reading source file: ${sourceFilePath}`, error);
    throw new Error(`Source file ${sourceFilePath} not found or could not be read.`);
  }

  const filesToCreate = parseProjectFile(fileContent);
  if (filesToCreate.length === 0) {
    throw new Error('No files to create. Check the format of the source file. It should use "// File: " delimiters.');
  }

  // Use the provided project name for the target folder
  const targetProjectFolder = projectName;
  // If an output directory is provided, use it. Otherwise, use the default base directory.
  const baseDir = outputDir ? outputDir : BASE_OUTPUT_DIR;
  const fullOutputDirectoryPath = path.join(baseDir, targetProjectFolder);

  console.log(`Found ${filesToCreate.length} files to create.`);
  console.log(`Target output directory: ${fullOutputDirectoryPath}`);
  await fs.rm(fullOutputDirectoryPath, { recursive: true, force: true });
  await fs.mkdir(fullOutputDirectoryPath, { recursive: true });

  for (const file of filesToCreate) {
    const fullPath = path.join(fullOutputDirectoryPath, file.path);
    const dirName = path.dirname(fullPath);

    try {
      // Ensure the directory for the current file exists
      await fs.mkdir(dirName, { recursive: true });
      // Write the file
      await fs.writeFile(fullPath, file.content);
      console.log(`Successfully created file: ${fullPath}`);
    } catch (error) {
      console.error(`Failed to create file: ${fullPath}`, error);
      // Continue to next file even if one fails
    }
  }
}

// API endpoint to trigger project generation
app.post('/generate-project', async (req, res) => {
  console.log('Received request to generate project...');
  const { sourceFilePath, projectName, outputDir } = req.body;

  if (!sourceFilePath || !projectName) {
    return res
      .status(400)
      .send(
        'Error: "sourceFilePath" and "projectName" are required in the request body.',
      );
  }

  try {
    await generateProject(sourceFilePath, projectName, outputDir);
    res
      .status(200)
      .send(`React project '${projectName}' generated successfully!`);
  } catch (error) {
    console.error('Project generation failed:', error);
    res.status(500).send(`Failed to generate project: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Project generator service listening on http://localhost:${PORT}`);
}); 