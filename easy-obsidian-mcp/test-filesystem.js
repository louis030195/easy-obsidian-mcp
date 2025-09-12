const { FilesystemSearch } = require('./dist/filesystem-search.js');

async function test() {
  const vaultPath = process.env.HOME + '/Documents/brain';
  console.log('Testing filesystem search with vault:', vaultPath);
  
  const fs = new FilesystemSearch(vaultPath);
  
  // Test fuzzy search
  console.log('\n=== Testing Fuzzy Search for "claude" ===');
  try {
    const fuzzyResults = await fs.fuzzySearch('claude', 3);
    console.log(`Found ${fuzzyResults.length} results:`);
    fuzzyResults.forEach(r => {
      console.log(`- ${r.filename} (${r.path})`);
      if (r.matches.length > 0) {
        console.log(`  First match: "${r.matches[0].content.substring(0, 100)}..."`);
      }
    });
  } catch (err) {
    console.error('Fuzzy search error:', err.message);
  }
  
  // Test graph search
  console.log('\n=== Testing Graph Search ===');
  try {
    const graphResults = await fs.graphSearch({
      vaultPath,
      includeOrphans: true,
      maxDepth: 1
    });
    console.log(`Found ${graphResults.length} notes in graph`);
    const orphans = graphResults.filter(r => 
      r.outgoingLinks.length === 0 && 
      (!r.incomingLinks || r.incomingLinks.length === 0)
    );
    console.log(`Orphaned notes: ${orphans.length}`);
    if (orphans.length > 0) {
      console.log('First 3 orphaned notes:');
      orphans.slice(0, 3).forEach(o => console.log(`- ${o.filename}`));
    }
  } catch (err) {
    console.error('Graph search error:', err.message);
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
      if (r.matches.length > 0) {
        console.log(`  Matches: ${r.matches.length}`);
      }
    });
  } catch (err) {
    console.error('Content search error:', err.message);
  }
}

test().catch(console.error);