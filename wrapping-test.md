# Text Wrapping Test Cases

Test these examples to verify that text wrapping works correctly for all types of content:

## Test 1: Plain Text (No Markdown)
```
This is a very long line of plain text without any markdown formatting that should wrap properly when it exceeds the width of the node. It should break at word boundaries and not cut off any words in the middle.
```

## Test 2: Plain Text with Line Breaks
```
First line of text
Second line of text
Third line that is much longer and should wrap properly when it gets too wide for the node
Fourth line
```

## Test 3: Headers Only
```
# This is a very long header that should wrap properly
## This is another long header that might need wrapping
### Short header
```

## Test 4: Mixed Content
```
# Long Project Title That Might Need Wrapping
This is a paragraph with regular text that should wrap properly when it gets too long for the node width.

## Tasks
- This is a very long list item that should wrap properly and maintain proper indentation
- Short item
- Another long list item with lots of text that needs to wrap correctly
```

## Test 5: Inline Formatting
```
This text has **bold formatting** and *italic formatting* and `code formatting` mixed together in a very long line that should wrap properly while maintaining the formatting.
```

## Test 6: Long Words
```
This line contains supercalifragilisticexpialidocious and other very long words that might cause wrapping issues if not handled properly.
```

## Test 7: Code Blocks
```
This line contains `very long code snippets that might need wrapping` and other text.
```

## Test 8: Complex Mixed
```
# Project: Advanced Text Wrapping System
**Status:** In development with *multiple* formatting types

## Current Issues
- Long text lines that exceed node width boundaries
- **Bold text** that needs proper wrapping
- `Code snippets` that should maintain formatting
- *Italic text* mixed with other formatting

## Solution
The new wrapping system handles all these cases properly.
```

## How to Test:
1. Copy each test case above
2. Create a new node (double-click)
3. Paste the test case
4. Press Enter to finish editing
5. Verify that:
   - Text wraps at word boundaries
   - No text is cut off or clipped
   - Node auto-resizes to fit content
   - Formatting is preserved
   - Lists maintain proper indentation

## Expected Results:
✅ All text should be visible
✅ No text should be clipped
✅ Wrapping should occur at word boundaries
✅ Nodes should auto-resize to fit content
✅ Formatting should be preserved
