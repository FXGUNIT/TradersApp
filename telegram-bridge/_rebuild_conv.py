"""Rebuild aiConversation.js without ML/provider functions."""
import os

base = "E:/TradersApp/telegram-bridge"
path = os.path.join(base, "aiConversation.js")

with open(path, "r", encoding="utf-8", errors="replace") as f:
    lines = f.readlines()

print("Total lines:", len(lines))
print("ML divider at line 157:", repr(lines[156]))
print("Main divider at line 526:", repr(lines[525]))

# Header: lines 1-11
header = lines[0:11]

# Middle: lines 12-156 (session + intent detection)
middle = lines[11:156]

# Bottom: lines 526-end (Main Conversation Handler)
bottom = lines[525:]

new_imports = """import {
  callMLEngine,
  callBFFConsensus,
  callBFFAdminSessions,
  callBFFRevokeSession,
  callBestAvailableAI,
} from "./aiProviders.js";
import { AI_PROVIDERS, SYSTEM_PROMPT } from "./aiConversationTypes.js";
import { formatConsensusForTelegram, formatMLResponse } from "./aiFormatters.js";

"""

new_content = header + [new_imports] + middle + bottom

with open(path, "w", encoding="utf-8") as f:
    f.writelines(new_content)

print("Written", len(new_content), "lines to aiConversation.js")
