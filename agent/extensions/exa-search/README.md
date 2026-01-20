# Exa Search Extension

Tools for searching code examples and web content using Exa's search API.

## Installation

No additional installation required. This extension uses the Exa search API.

## Tools

### search-code

**Label:** Search Code

**Description:** Find relevant code examples, documentation, and API references.

Use this to:
- Get code snippets for libraries and frameworks
- Understand API usage patterns
- Find implementation examples for specific tasks
- Learn best practices from real code

Provides high-quality, up-to-date programming context.

**Parameters:**
- `query` (string): Search query to find relevant context for APIs, Libraries, and SDKs. For example, 'React useState hook examples', 'Python pandas dataframe filtering', 'Express.js middleware', 'Next js partial prerendering configuration'
- `tokensNum` (number, optional): Number of tokens to return (1000-50000). Default is 5000 tokens. Adjust this value based on how much context you need.

### search-web

**Label:** Search Web

**Description:** Perform real-time web searches and content scraping.

Use this to:
- Find current information and recent updates
- Research topics across the internet
- Get fresh data for analysis
- Access content from specific websites

Supports live crawling and different search depths.

**Parameters:**
- `query` (string): Websearch query
- `numResults` (number, optional): Number of search results to return (default: 8)
- `livecrawl` (enum, optional): Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')
- `type` (enum, optional): Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search
- `contextMaxCharacters` (number, optional): Maximum characters for context string optimized for LLMs (default: 10000)