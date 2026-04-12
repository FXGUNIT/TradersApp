"""Rebuild aiConversation.js without ML/provider functions."""
import os

base = "E:/TradersApp/telegram-bridge"
path = os.path.join(base, "aiConversation.js")

with open(path, "r", encoding="utf-8", errors="replace") as f:
    raw = f.read()

# Find where the old module breakdown comment starts and ends in the source
# The doc block runs: /** ... * Module breakdown: ... * /   (then blank, then imports)
old_doc_end = raw.find(" * Module breakdown:")
next_star_slash = raw.find(" */", old_doc_end)
# line after */
newline_after_doc = raw.find("\n", next_star_slash)

old_import_end = raw.find("import { formatConsensusForTelegram", old_doc_end)
newline_after_imports = raw.find("\n", old_import_end)

print("Doc block ends at char:", next_star_slash)
print("After old imports newline char:", newline_after_imports)

# Build new file:
# 1. Up to and including " */" in the old doc comment
# 2. New module breakdown (with aiProviders.js added)
# 3. New imports
# 4. Lines after old imports (session + intent + bottom)

new_module_block = (
    "\n"
    " * Module breakdown:\n"
    " *   aiConversationTypes.js -- AI_PROVIDERS config, SYSTEM_PROMPT, type defs\n"
    " *   aiProviders.js        -- ML/BFF HTTP wrappers, AI provider calls\n"
    " *   aiConversation.js     -- conversation memory, intent detection, orchestrator\n"
    " *   aiFormatters.js       -- formatConsensusForTelegram, formatMLResponse\n"
    " */\n"
    "\n"
    "import {\n"
    "  callMLEngine,\n"
    "  callBFFConsensus,\n"
    "  callBFFAdminSessions,\n"
    "  callBFFRevokeSession,\n"
    "  callBestAvailableAI,\n"
    "} from \"./aiProviders.js\";\n"
    "import { AI_PROVIDERS, SYSTEM_PROMPT } from \"./aiConversationTypes.js\";\n"
    "import { formatConsensusForTelegram, formatMLResponse } from \"./aiFormatters.js\";\n"
    "\n"
)

# New file = doc header up to " */" (exclusive) + new module block + everything after old imports
new_file = raw[:next_star_slash] + new_module_block + raw[newline_after_imports+1:]

with open(path, "w", encoding="utf-8") as f:
    f.write(new_file)

print("Written", len(new_file.splitlines()), "lines to aiConversation.js")