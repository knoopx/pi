# Introduction

Vicinae is typically extended using its React/TypeScript API, which allows you to focus on your extension while offloading all the complex UI rendering to the C++ core.

This page explains this design choice and gives a sneak peek at what extension code looks like.

## Why TypeScript?

TypeScript is a well-established scripting language with clean syntax and, most importantly, a thriving ecosystem around it.

Since we use [NodeJS](https://nodejs.org/en), we also support all the regular node APIs you might want to use.

The asynchronous model also makes it well-suited for fetching and transforming external data, presenting it, and so on—which is typically what most extensions will do.

## Why React?

Since we're dealing with UI most of the time, we'd need a state management library anyway.

When a piece of state changes, the component rerenders, and it's up to the renderer (in this case, the Vicinae process) to ensure everything is handled gracefully and efficiently.

React is also, like TypeScript, well-established and widely known among developers.

Although React is typically associated with web development (since that's its most common use case), the React library is platform-agnostic.

## Where's the browser at?

There is **no browser** backing the Vicinae extension ecosystem. No browser, no Electron, no HTML, no CSS...

It's pure JavaScript producing a serialized representation of the UI tree, which is then sent to the C++ Vicinae process and rendered as native UI from there.

All you need is a JavaScript runtime to execute JavaScript on the server-side (we use `node`), and everything works smoothly and efficiently.

## Code example

If you write this:

```
import { ActionPanel, Action, List, Icon } from '@vicinae/api';
import { fruits } from './data';

export default function FruitList() {
	return (
		<List isShowingDetail searchBarPlaceholder={'Search fruits...'}>
			<List.Section title="Fruits">
				{fruits.map(fruit => (
					<List.Item
						key={fruit.emoji}
						title={fruit.name}
						icon={fruit.emoji}
						detail={<List.Item.Detail markdown={fruit.description} />}
						actions={
							<ActionPanel>
								<Action.CopyToClipboard
									title="Copy emoji"
									content={fruit.emoji}
								/>
							</ActionPanel>
						}
					/>
				))}
			</List.Section>
		</List>
	);
}
```

You get this:

Search automatically works, markdown is automatically formatted, life's great :)

## Raycast compatibility

Most of the extension stuff is inspired by the way [Raycast](https://developers.raycast.com/) does it, and our long-term goal is to be compatible with most existing Raycast extensions.

For this reason, our API follows the Raycast API closely but also offers exclusive APIs.

Since Vicinae is open source and community-driven, we tend to prioritize API features that most users want to see implemented first.
