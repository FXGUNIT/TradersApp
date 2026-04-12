"""Rebuild aiConversation.js — correct module breakdown search."""
import os

base = "E:/TradersApp/telegram-bridge"
path = os.path.join(base, "aiConversation.js")

with open(path, "r", encoding="utf-8", errors="replace") as f:
    raw = f.read()

# Find the module breakdown comment block
mb_pos = raw.find(" * Module breakdown:")
# First " */" after module breakdown is the old module block close
old_module_block_end = raw.find(" */", mb_pos) + 4  # char after "\n" in " */\n"

# Find where the old imports end
imports_line_start = raw.find("import { formatConsensusForTelegram", mb_pos)
newline_after_imports = raw.find("\n", imports_line_start)

print("Module block end at char:", old_module_block_end)
print("After imports newline at char:", newline_after_imports)

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

# New file = doc header up to old module block end + new module block + everything after old imports
new_file = raw[:old_module_block_end] + new_module_block + raw[newline_after_imports+1:]

with open(path, "w", encoding="utf-8") as f:
    f.write(new_file)

print("Written", len(new_file.splitlines()), "lines to aiConversation.js")