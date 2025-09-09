import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';

export const initCommand = new Command('init')
  .description('Initialize .on-the-go folder structure')
  .action(async () => {
    try {
      const onTheGoDir = '.on-the-go';
      
      // Check if directory already exists
      try {
        await fs.access(onTheGoDir);
        console.log('❌ .on-the-go folder already exists!');
        console.log('   If you want to reinitialize, please remove the existing folder first.');
        return;
      } catch {
        // Directory doesn't exist, continue
      }
      
      // Create main directory
      await fs.mkdir(onTheGoDir, { recursive: true });
      console.log('📁 Created .on-the-go/ directory');
      
      // Create subdirectories
      await fs.mkdir(path.join(onTheGoDir, 'prompts'), { recursive: true });
      console.log('📁 Created .on-the-go/prompts/ directory');
      
      await fs.mkdir(path.join(onTheGoDir, 'results'), { recursive: true });
      console.log('📁 Created .on-the-go/results/ directory');
      
      // Create default config.json
      const config = {
        version: "1.0.0",
        server: {
          port: 3900,
          host: "localhost"
        },
        terminal: {
          shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
          cwd: process.cwd()
        },
        prompts: {
          directory: "./.on-the-go/prompts",
          autoSave: true
        },
        results: {
          directory: "./.on-the-go/results",
          format: "json"
        },
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(onTheGoDir, 'config.json'),
        JSON.stringify(config, null, 2)
      );
      console.log('📄 Created .on-the-go/config.json');
      
      // Create example prompt
      const examplePrompt = {
        name: "example-prompt",
        description: "Example prompt template",
        template: "Hello {{name}}! Welcome to {{app}}.",
        variables: ["name", "app"],
        created: new Date().toISOString()
      };
      
      await fs.writeFile(
        path.join(onTheGoDir, 'prompts', 'example.json'),
        JSON.stringify(examplePrompt, null, 2)
      );
      console.log('📄 Created .on-the-go/prompts/example.json');
      
      // Create README for the .on-the-go folder
      const readme = `# .on-the-go Folder

This folder contains configuration and data for Kiro Remote CLI.

## Structure

- \`config.json\` - Main configuration file
- \`prompts/\` - Prompt templates and configurations
- \`results/\` - Output results and logs

## Configuration

The \`config.json\` file contains settings for:
- Server configuration (port, host)
- Terminal settings (shell, working directory)
- Prompt management
- Result formatting

## Usage

Run \`kiro-remote start\` to launch the server with this configuration.

Created: ${new Date().toISOString()}
`;
      
      await fs.writeFile(
        path.join(onTheGoDir, 'README.md'),
        readme
      );
      console.log('📄 Created .on-the-go/README.md');
      
      console.log('\\n✅ .on-the-go folder structure created successfully!');
      console.log('\\n📁 Structure:');
      console.log('   .on-the-go/');
      console.log('   ├── config.json');
      console.log('   ├── prompts/');
      console.log('   │   └── example.json');
      console.log('   ├── results/');
      console.log('   └── README.md');
      console.log('\\n🚀 You can now run: kiro-remote start');
      
    } catch (error) {
      console.error('❌ Failed to initialize .on-the-go folder:', error);
      process.exit(1);
    }
  });