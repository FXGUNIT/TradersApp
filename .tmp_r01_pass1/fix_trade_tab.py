#!/usr/bin/env python3
with open('E:/TradersApp/src/features/terminal/TradeTab.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Use regex to find and replace the screenshot section
import re

# Pattern: from "{/* Image Upload Zones */}" to "{/* Notes */}"
# using non-greedy match
pattern = r'(\s*{/\* Image Upload Zones \*/\}\s*<div\b.*?<div style=\{\{.*?</div>\s*</div>\s*)'

# Actually, let's try a simpler approach - find the start and end markers
start_marker = '{/* Image Upload Zones */}'
end_marker = '{/* Notes */}'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(f'start_idx: {start_idx}')
print(f'end_idx: {end_idx}')

if start_idx == -1:
    print('START NOT FOUND')
elif end_idx == -1:
    print('END NOT FOUND')
else:
    # Find the beginning of the line containing start_marker
    line_start = content.rfind('\n', 0, start_idx) + 1
    # Find the end of the line containing end_marker (go past "/* Notes */")
    line_end = content.find('\n', end_idx)
    # include the /* Notes */ line itself as start of next section
    # Actually the Notes line itself should stay, so we want content before it
    # and the Notes comment itself

    # Find where the screenshot section ends - it's before "{/* Notes */}"
    # The previous character before /* Notes */ should be a newline
    # Let's find the complete block
    print('Content between markers:')
    print(repr(content[start_idx-50:end_idx+100]))
