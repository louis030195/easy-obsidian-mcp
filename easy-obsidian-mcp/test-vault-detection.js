const { VaultDetector } = require('./dist/vault-detector.js');

async function test() {
  const detector = new VaultDetector();
  
  console.log('Testing vault detection...\n');
  
  // Check stored config
  const stored = await detector.getStoredVaultPath();
  if (stored) {
    console.log('Stored vault path:', stored);
  } else {
    console.log('No stored vault path found');
  }
  
  // Auto-detect vaults
  console.log('\nAuto-detecting vaults...');
  const vaults = await detector.detectVaults();
  
  if (vaults.length === 0) {
    console.log('No vaults found');
  } else {
    console.log(`Found ${vaults.length} vault(s):`);
    vaults.forEach((v, i) => {
      console.log(`${i + 1}. ${v.name} at ${v.path}`);
      console.log(`   Has .obsidian folder: ${v.hasObsidianFolder}`);
    });
  }
  
  // Try auto-detect
  console.log('\nAuto-detecting best vault...');
  const autoPath = await detector.autoDetectVault();
  if (autoPath) {
    console.log('Auto-detected vault:', autoPath);
    
    // Store it
    await detector.storeVaultPath(autoPath);
    console.log('Stored vault path for future use');
  } else {
    console.log('Could not auto-detect vault');
  }
}

test().catch(console.error);