# Browser Extension

Tools for web scraping and browser automation using Puppeteer and Cromite.

## Installation

This extension requires the Cromite browser to be installed on your system.

Cromite is a privacy-focused browser based on Chromium. You can install it from:
- [Cromite website](https://cromite.org/) or package managers

The extension will automatically start and manage Cromite processes for automation.

## Tools

### navigate-url

**Label:** Navigate URL

**Description:** Navigate to a specific URL in a new browser tab.

Use this to:
- Visit web pages for data extraction
- Load specific pages for testing or scraping
- Open new tabs for parallel processing

Always opens in a new tab.

**Parameters:**
- `url` (string): URL to navigate to

### evaluate-javascript

**Label:** Evaluate JavaScript

**Description:** Execute JavaScript code in the context of the current web page.

Use this to:
- Extract data from complex page structures
- Interact with JavaScript-heavy websites
- Test and debug web page functionality
- Access browser APIs and page content

Returns the result of the executed code.

**Parameters:**
- `code` (string): JavaScript code to evaluate

### take-screenshot

**Label:** Take Screenshot

**Description:** Capture a screenshot of the current browser page.

Use this to:
- Document web page states during automation
- Verify visual changes or layouts
- Debug rendering issues
- Archive important web content

Saves the image to a temporary file and returns the path.

**Parameters:** None

### query-html-elements

**Label:** Query HTML Elements

**Description:** Extract HTML elements from the current page using CSS selectors.

Use this to:
- Inspect page structure and element details
- Extract specific HTML components for analysis
- Debug web scraping selectors
- Understand page layout and styling

Returns formatted HTML of matching elements.

**Parameters:**
- `selector` (string): CSS selector to query
- `all` (boolean, optional): Extract all matching elements

### list-browser-tabs

**Label:** List Browser Tabs

**Description:** Get information about all open browser tabs.

Use this to:
- See current browsing session state
- Identify which tabs are active
- Manage multiple tab automation workflows
- Debug tab switching operations

Shows tab index, title, URL, and active status.

**Parameters:** None

### close-tab

**Label:** Close Tab

**Description:** Close a specific browser tab by index or title.

Use this to:
- Clean up completed automation sessions
- Manage browser resource usage
- Reset tab state for fresh operations
- Handle multiple concurrent tasks

Cannot close the last remaining tab.

**Parameters:**
- `index` (number, optional): Tab index to close (0-based)
- `title` (string, optional): Close tab with this title (partial match)

### switch-tab

**Label:** Switch Tab

**Description:** Switch focus to a different browser tab by index.

Use this to:
- Navigate between multiple automation contexts
- Continue work in specific tabs
- Manage parallel scraping operations
- Access different web applications

Makes the specified tab active for subsequent operations.

**Parameters:**
- `index` (number): Tab index to switch to (0-based)

### refresh-tab

**Label:** Refresh Tab

**Description:** Reload the current browser tab.

Use this to:
- Update dynamic web content
- Reset page state during testing
- Handle stale data in automation
- Refresh after form submissions or state changes

Waits for the page to fully load before returning.

**Parameters:** None

### current-url

**Label:** Current URL

**Description:** Get the URL of the currently active browser tab.

Use this to:
- Verify navigation results
- Track current page location
- Log browsing session progress
- Validate redirects and page changes

Returns the full URL including query parameters.

**Parameters:** None

### page-title

**Label:** Page Title

**Description:** Get the title of the currently active browser tab.

Use this to:
- Identify current page content
- Verify page load completion
- Log browsing activity
- Check for expected page titles

Returns the text from the browser's title bar.

**Parameters:** None

### wait-for-element

**Label:** Wait for Element

**Description:** Wait for a CSS selector to appear on the page.

Use this to:
- Synchronize with dynamic page loading
- Ensure elements are ready before interaction
- Handle AJAX-loaded content
- Test page rendering performance

Blocks until the element exists or timeout occurs.

**Parameters:**
- `selector` (string): CSS selector to wait for
- `timeout` (number, optional): Timeout in milliseconds (default 10000)

### click-element

**Label:** Click Element

**Description:** Click on HTML elements matching a CSS selector.

Use this to:
- Interact with buttons, links, and form controls
- Navigate through web applications
- Trigger JavaScript events and actions
- Submit forms or activate dropdowns

Can click single elements or all matching elements.

**Parameters:**
- `selector` (string): CSS selector to click
- `all` (boolean, optional): Click all matching elements

### type-text

**Label:** Type Text

**Description:** Type text into input fields or focused elements.

Use this to:
- Fill out web forms automatically
- Enter search queries or data
- Simulate user keyboard input
- Test input validation and handling

Optionally clears existing content before typing.

**Parameters:**
- `selector` (string, optional): CSS selector to focus (optional)
- `text` (string): Text to type
- `clear` (boolean, optional): Clear field before typing

### extract-text

**Label:** Extract Text

**Description:** Extract text content from HTML elements by CSS selector.

Use this to:
- Scrape text data from web pages
- Extract article content or product information
- Gather data for analysis or processing
- Monitor dynamic text changes

Returns plain text from matching elements.

**Parameters:**
- `selector` (string): CSS selector to extract text from
- `all` (boolean, optional): Extract from all matching elements