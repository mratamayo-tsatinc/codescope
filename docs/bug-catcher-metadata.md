# Bug Catcher exercise metadata

Bug Catcher exercises store valid, reusable source code. The activity creates the faulty presentation from `@bug` records in the leading `@codescope` block.

```c
/*
 * @codescope
 * @title Basic Structure
 * @bug id=opening-brace line=4 token=1 correct="{" wrong="}" choices="}|)"
 */
#include <stdio.h>

int main()
{
    return 0;
}
```

Each `@bug` record contains:

- `id`: unique stable identifier within the file.
- `line`: one-based line in the source after the metadata block is removed.
- `token`: one-based selectable token on that line. Whitespace and comments do not count.
- `correct`: exact token in the valid source. Loading fails if the target does not match.
- `wrong`: authored replacement token.
- `choices`: optional `|` separated replacement tokens for seeded mode.

`content.bugs.mode: 'authored'` applies every record using `wrong`. `content.bugs.mode: 'seeded'` randomly selects the configured `count` and materializes a replacement from `choices`, falling back to `wrong`. The generated mutation plan is stored with the item so reset, retry, persistence, and scoring use the same faults.

Legacy `[[...]]` markers are not supported. Keeping the source valid allows Trace, Simulate, and Code Ordering profiles to point to the same exercise set.
