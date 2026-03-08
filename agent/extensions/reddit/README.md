# reddit

Reddit listing/search tools backed by Reddit JSON endpoints.

## Tools

### `reddit`

Fetch subreddit feed posts.

Parameters:

- `subreddit`
- `feedType`: `hot | new | top | rising`
- `limit` (1-25)

### `reddit-search`

Search Reddit globally or within one subreddit.

Parameters:

- `query`
- `subreddit?`
- `sort`: `relevance | hot | top | new | comments`
- `time`: `hour | day | week | month | year | all`
- `limit` (1-25)

## Output

- Table columns include score, comments, age, title/author/link.
- `details` includes structured post data for follow-up processing.

## Notes

- Uses a custom User-Agent and shared request throttling.
- API/response errors are surfaced as explicit failures.
