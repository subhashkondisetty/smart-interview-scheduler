import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { calculateProfileCompletion } from '../src/utils/profileCompletion.js';

const require = createRequire(import.meta.url);
const CandidateProfile = require('../../server/models/CandidateProfile.js');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.resolve(__dirname, '../../server/tests/fixtures/profileCompletionFixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

let failures = 0;
console.log('--- Profile Completion Parity: Live Cross-Tier Verification ---');

for (const { name, profile, expectedPercentage, expectedSections } of fixtures) {
  // 1. Backend Mongoose Model execution (in-memory document instantiation)
  const serverDoc = new CandidateProfile(profile);
  const serverScore = serverDoc.calculateCompletion();

  // 2. Client Utility execution
  const clientResult = calculateProfileCompletion(profile);
  const clientScore = clientResult.percentage;

  // 3. Mathematical Parity Check
  if (serverScore !== expectedPercentage || clientScore !== expectedPercentage || serverScore !== clientScore) {
    console.error(`FAIL: "${name}"`);
    console.error(`  Expected: ${expectedPercentage}% | Server: ${serverScore}% | Client: ${clientScore}%`);
    failures++;
  } else {
    console.log(`  PASS: "${name}" -> Server: ${serverScore}%, Client: ${clientScore}% (Parity Confirmed)`);
  }

  // 4. Section Flag Check
  if (expectedSections) {
    for (const [sectionKey, expectedBool] of Object.entries(expectedSections)) {
      if (clientResult.sections[sectionKey] !== expectedBool) {
        console.error(`  FAIL [Section Flag]: ${name} -> section "${sectionKey}" expected ${expectedBool}, got ${clientResult.sections[sectionKey]}`);
        failures++;
      }
    }
  }
}

if (failures === 0) {
  console.log(`\nAll ${fixtures.length} fixtures passed with 100% mathematical parity across server and client!`);
  process.exit(0);
} else {
  console.error(`\nDetected ${failures} parity failures!`);
  process.exit(1);
}
