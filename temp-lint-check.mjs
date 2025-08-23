#!/usr/bin/env node

import { exec } from 'child_process';
import { promises as fs } from 'fs';

console.log('🔍 Counting remaining @typescript-eslint/no-unused-vars violations...\n');

// Run ESLint specifically for no-unused-vars rule
exec('npx eslint . --format=json --no-eslintrc --config "{\\"extends\\": [], \\"rules\\": {\\"@typescript-eslint/no-unused-vars\\": \\"error\\"}}"', (error, stdout, stderr) => {
  if (error) {
    console.log('Running regular ESLint check...');
    
    // Fallback to regular ESLint
    exec('npx eslint . --format=json', (fallbackError, fallbackStdout, fallbackStderr) => {
      try {
        const results = JSON.parse(fallbackStdout);
        let totalViolations = 0;
        const violationsByFile = {};

        results.forEach(file => {
          if (file.messages && file.messages.length > 0) {
            const noUnusedVarsViolations = file.messages.filter(
              message => message.ruleId === '@typescript-eslint/no-unused-vars'
            );
            
            if (noUnusedVarsViolations.length > 0) {
              violationsByFile[file.filePath] = noUnusedVarsViolations;
              totalViolations += noUnusedVarsViolations.length;
            }
          }
        });

        console.log(`📊 Total @typescript-eslint/no-unused-vars violations: ${totalViolations}\n`);

        if (totalViolations > 0) {
          console.log('📁 Files with violations:');
          Object.entries(violationsByFile).forEach(([filePath, violations]) => {
            const relativePath = filePath.replace(process.cwd() + '/', '');
            console.log(`\n${relativePath} (${violations.length} violations):`);
            violations.forEach(violation => {
              console.log(`  Line ${violation.line}:${violation.column} - ${violation.message}`);
            });
          });
        } else {
          console.log('✅ No @typescript-eslint/no-unused-vars violations found!');
        }

      } catch (parseError) {
        console.error('Error parsing ESLint output:', parseError);
        if (fallbackStderr) console.error('Stderr:', fallbackStderr);
      }
    });
  }
});