# Changelog

## [0.2.0] - 2025-01-10

### Added
- **Pagination support for simple search** - Added `max_results` (default: 20) and `offset` parameters to prevent token overflow when searching large vaults
- **LIST and TASK query support** - Automatically converts LIST and TASK dataview queries to TABLE format for API compatibility
- **Pagination for file listing** - Added `max_items` (default: 50) and `offset` parameters to handle large directories
- **Sorting options for file listing** - Added `sort_by` (name/modified/created/size) and `sort_order` (asc/desc) parameters
- **Enhanced error handling** - Improved error messages and suggestions for common issues
- **Query optimization hints** - Better suggestions for dataview queries including performance tips

### Changed
- Simple search now returns pagination metadata including `total_results`, `has_more`, and pagination hints
- File listing now returns `total_items` and `returned_items` counts with pagination info
- Dataview queries now show conversion notes when LIST/TASK queries are converted to TABLE format
- Improved suggestion system with query-specific optimization tips

### Fixed
- Large search results no longer cause token overflow errors
- File listing in large directories no longer fails
- Better handling of LIST and TASK dataview queries that previously failed

### Technical Details
- All pagination is performed client-side after fetching results from Obsidian API
- LIST queries are converted to `table file.name` format
- TASK queries are converted to `table file.name, file.tasks` format
- Image processing remains disabled due to MCP SDK/Claude API compatibility issues

## [0.1.1] - Previous version
- Initial implementation with basic search, dataview, and file operations