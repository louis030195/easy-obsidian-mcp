const { FilesystemSearch } = require('./dist/filesystem-search.js');

async function test() {
  const vaultPath = '/Users/louisbeaumont/Documents/brain';
  console.log('Testing filesystem search with brain vault:', vaultPath);
  
  const fs = new FilesystemSearch(vaultPath);
  
  // Test fuzzy search
  console.log('\n=== Testing Fuzzy Search for "claude" ===');
  try {
    const fuzzyResults = await fs.fuzzySearch('claude', 3);
    console.log(`Found ${fuzzyResults.length} results:`);
    fuzzyResults.forEach(r => {
      console.log(`- ${r.filename}`);
    });
  } catch (err) {
    console.error('Fuzzy search error:', err.message);
  }
  
  // Test content search
  console.log('\n=== Testing Content Search for "obsidian" ===');
  try {
    const searchResults = await fs.search({
      vaultPath,
      query: 'obsidian',
      maxResults: 3,
      searchType: 'content'
    });
    console.log(`Found ${searchResults.length} results:`);
    searchResults.forEach(r => {
      console.log(`- ${r.filename}`);
    });
  } catch (err) {
    console.error('Content search error:', err.message);
  }
}

test().catch(console.error);