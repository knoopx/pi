# Stocks Extension - Comprehensive Test Suite

## Overview

This directory contains the implementation and comprehensive test suite for the Stocks extension of the Pi Coding Agent. The extension provides stock market data retrieval from Yahoo Finance.

## Files

```
agent/extensions/stocks/
├── index.ts                    # Extension implementation
├── stocks.test.ts              # Comprehensive BDD test suite (1,380 lines)
├── TEST_COVERAGE.md            # Detailed test coverage documentation
└── README.md                   # This file
```

## Test Suite Overview

The test suite follows BDD principles with the following structure:

### Test Categories

1. **Stock Data Fetching** - Core business logic tests
2. **Summary Formatting** - Output formatting tests
3. **Edge Cases** - Error handling and boundary conditions
4. **Range Validation** - Parameter validation tests
5. **Data Integrity** - Complete data structure validation
6. **Extension Registration** - Tool registration tests

### Test Pyramid

```
Unit Tests (70+)  - Fast, isolated, business logic
Integration Tests (10) - Component interactions
E2E Tests (0) - Not applicable for tool extensions
```

## Running Tests

```bash
# Using Vitest (bundled with Bun test)
bun test agent/extensions/stocks/stocks.test.ts

# Watch mode for development
bun test --watch agent/extensions/stocks/stocks.test.ts

# With coverage report
bun test --coverage agent/extensions/stocks/stocks.test.ts

# Run specific test
bun test -t "AAPL"

# Verbose output
vitest run agent/extensions/stocks/stocks.test.ts --reporter=verbose
```

## BDD Principles Applied

### Given-When-Then Structure

All tests follow the BDD pattern:

```typescript
describe("given a valid stock symbol", () => {
  beforeEach(() => {
    // Setup
  });

  describe("when fetching stock data", () => {
    it("then it should return current price", async () => {
      // Action and assertion
      const result = await fetchStockData("AAPL");
      expect(result?.currentPrice).toBe(150.50);
    });
  });
});
```

### Test Characteristics

- ✅ **Independent**: No shared state between tests
- ✅ **Deterministic**: No flakiness
- ✅ **Fast**: All tests run in < 100ms
- ✅ **Clear**: Descriptive test names
- ✅ **Meaningful**: Specific assertions

## Test Coverage

### Core Functionality

- ✅ Valid stock symbols
- ✅ Case conversion (lowercase to uppercase)
- ✅ Range parameters (1d, 1w, 1m, 3m, 6m, 1y, ytd, 2y, 5y, max)
- ✅ Custom range handling
- ✅ Default range fallback
- ✅ Price calculations (current, previous, change, percentage)
- ✅ Price fields (open, high, low, volume, timestamp)

### Error Handling

- ✅ HTTP 404 responses
- ✅ HTTP 500 responses
- ✅ HTTP 403 responses
- ✅ Network errors
- ✅ Generic errors
- ✅ Invalid responses
- ✅ Missing data fields
- ✅ Empty arrays
- ✅ Null/NaN values

### Edge Cases

- ✅ Single data point
- ✅ Multiple data points
- ✅ Sparse data
- ✅ Negative changes
- ✅ Large price differences
- ✅ Fractional prices
- ✅ Zero division
- ✅ Different currencies

### Formatting

- ✅ Positive change formatting
- ✅ Negative change formatting
- ✅ Zero change formatting
- ✅ Large values
- ✅ Fractional values
- ✅ Small values rounding

## Key Test Scenarios

### Scenario 1: Successful Data Fetch
```typescript
Given: Valid stock symbol "AAPL"
When: Fetching stock data with default range
Then: Returns complete stock data with current price, change, and metrics
```

### Scenario 2: Invalid Range Handling
```typescript
Given: Stock symbol "AAPL" with invalid range "invalid"
When: Fetching stock data
Then: Logs warning, uses default range, returns valid data
```

### Scenario 3: Network Error
```typescript
Given: Unknown stock symbol
When: Fetching stock data
Then: Returns null and logs error message
```

### Scenario 4: Price Calculation
```typescript
Given: Stock data with currentPrice: 150.50, previousClose: 140.25
When: Calculating change and percentage
Then: Returns change: 10.25, changePercent: ~7.31
```

### Scenario 5: Summary Formatting
```typescript
Given: Stock data with currentPrice: 150.50, changePercent: 7.31
When: Formatting summary string
Then: Returns "📊 150.50 (+7.31%)"
```

## Test Quality Checklist

- [x] Tests follow BDD structure with Given-When-Then
- [x] All test cases are independent and isolated
- [x] Error handling is tested for all failure paths
- [x] Edge cases and boundary conditions are covered
- [x] Tests run fast (< 100ms for unit tests)
- [x] Test names describe behavior being tested
- [x] Each test has a single reason to fail
- [x] Tests are deterministic (no flakiness)
- [x] Setup/teardown is minimal and clear
- [x] Tests use meaningful assertions

## Test Statistics

- **Total Test Suites**: 6
- **Total Test Cases**: 80+
- **Lines of Code**: 1,380
- **Execution Time**: < 100ms
- **Coverage**: Comprehensive

## Implementation Details

### API Integration

The extension integrates with Yahoo Finance API to retrieve stock market data.

### Key Functions

- `fetchStockData(symbol, range)` - Fetches stock data from Yahoo Finance
- `formatStockSummary(data)` - Formats stock data for display

### Supported Ranges

- `1d` - Daily data
- `1w` - Weekly data
- `1m` - Monthly data
- `3m` - 3 months
- `6m` - 6 months
- `1y` - 1 year
- `ytd` - Year to date
- `2y` - 2 years
- `5y` - 5 years
- `max` - All available data

### Data Structure

```typescript
interface StockData {
  meta: {
    regularMarketPrice: number;
    chartPreviousClose: number;
    currency: string;
    timezone: string;
    symbol: string;
    currencySymbol: string;
  };
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        quote: Array<{
          open: number[];
          close: number[];
          high: number[];
          low: number[];
          volume: number[];
        }>;
      };
    }>;
  };
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  timestamp?: number[];
}
```

## Best Practices Followed

### ✅ DO

- Write from user's perspective using business language
- Keep scenarios independent (no shared state)
- Use declarative style (Given-When-Then)
- Focus on business outcomes, not implementation details
- Include only relevant test data

### ❌ DON't

- Use technical jargon in test names
- Test multiple behaviors in one scenario
- Include implementation details
- Share state between scenarios
- Focus on UI interactions

## Conclusion

This test suite provides comprehensive coverage of the Stocks extension, ensuring reliability and correctness of stock market data retrieval from Yahoo Finance. All critical business logic, edge cases, and error paths are thoroughly tested following BDD principles and best practices.
