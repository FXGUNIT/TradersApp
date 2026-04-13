$content = [System.IO.File]::ReadAllText("$PSScriptRoot\src\App.jsx", [System.Text.Encoding]::UTF8)

# Fix common corrupted emoji patterns
$replacements = @{
    # Theme icons
    'ðŸŒ™' = '🌙'
    'â˜€ï¸' = '☀️'
    'â˜€ï¸"' = '☀️'
    
    # Building/office
    'ðŸ"' = '🏛'
    'ðŸ"' = '🏛'
    
    # Search
    'âŒ˜' = '⌘'
    'âŒ˜' = '⌘'
    
    # Gear/settings
    'âš™ï¸' = '⚙️'
    'âš™ï¸"' = '⚙️'
    
    # Charts/dashboard
    'ðŸ"Š' = '📊'
    'ðŸ"Š' = '📊'
    
    # Users/people
    'ðŸ"¥' = '👥'
    'ðŸ"¥' = '👥'
    'ðŸ"' = '👤'
    'ðŸ"' = '👤'
    
    # Diamond
    'ðŸ' = '💎'
    'ðŸ' = '💎'
    
    # Time
    'â•°' = '⏰'
    'â•³' = '⏳'
    'â•±' = '⏱'
    'â•±ï¸' = '⏱'
    
    # Warning/alert
    'ðŸ¨' = '🚨'
    'ðŸ¨' = '🚨'
    
    # Search
    'ðŸ""' = '🔍'
    'ðŸ"' = '🔍'
    
    # Clap
    'ðŸ""' = '👏'
    'ðŸ"' = '👏'
    
    # Train
    'ðŸ«' = '🚃'
    'ðŸ«' = '🚃'
    
    # People
    'ðŸ' = '👥'
    'ðŸ' = '👥'
    
    # Ghost
    'ðŸ' = '👻'
    'ðŸ' = '👻'
    
    # Head
    'ðŸ' = '🧑'
    'ðŸ' = '🧑'
    
    # Video
    'ðŸ""' = '📺'
    'ðŸ"' = '📺'
    
    # Bell/notification
    'ðŸ""' = '🔔'
    'ðŸ"' = '🔔'
    
    # Mic
    'ðŸ""' = '📣'
    'ðŸ"' = '📣'
    
    # Lock
    'ðŸ' = '🔒'
    'ðŸ' = '🔒'
    
    # Key
    'ðŸ' = '🔑'
    'ðŸ' = '🔑'
    
    # Flash
    'âš¡' = '⚡'
    
    # Camera
    'ðŸ""' = '📷'
    'ðŸ"' = '📷'
    
    # Upload/download
    'ðŸ' = '📤'
    'ðŸ' = '📤'
    'ðŸ' = '📥'
    'ðŸ' = '📥'
    
    # Folder
    'ðŸ' = '📁'
    'ðŸ' = '📁'
    
    # Envelope
    'ðŸ' = '📧'
    'ðŸ' = '📧'
    'ðŸ' = '📩'
    'ðŸ' = '📩'
    
    # Calendar
    'ðŸ' = '📅'
    'ðŸ' = '📅'
    
    # Document
    'ðŸ""' = '📄'
    'ðŸ"' = '📄'
    'ðŸ""' = '📃'
    'ðŸ"' = '📃'
    
    # Clipboard
    'ðŸ' = '📋'
    'ðŸ' = '📋'
    
    # Disk
    'ðŸ' = '💾'
    'ðŸ' = '💾'
    
    # Money
    'ðŸ' = '💰'
    'ðŸ' = '💰'
    
    # Check
    'ðŸ' = '✅'
    'ðŸ' = '✅'
    
    # Cross
    'ðŸ' = '❌'
    'ðŸ' = '❌'
    
    # Folder
    'ðŸ' = '📂'
    'ðŸ' = '📂'
    
    # Gear
    'ðŸ' = '⚙'
    'ðŸ' = '⚙'
    
    # Wrench
    'ðŸ' = '🔧'
    'ðŸ' = '🔧'
    
    # Hammer
    'ðŸ' = '🔨'
    'ðŸ' = '🔨'
    
    # Bulb
    'ðŸ' = '💡'
    'ðŸ' = '💡'
    
    # Reload
    'ðŸ' = '🔄'
    'ðŸ' = '🔄'
    
    # Eye
    'ðŸ' = '👁'
    'ðŸ' = '👁'
    
    # Globe
    'ðŸŒ' = '🌐'
    'ðŸŒ' = '🌐'
    
    # Truck
    'ðŸ' = '🚚'
    'ðŸ' = '🚚'
    
    # Home
    'ðŸ' = '🏠'
    'ðŸ' = '🏠'
    
    # House
    'ðŸ' = '🏡'
    'ðŸ' = '🏡'
    
    # Person
    'ðŸ' = '🧑'
    'ðŸ' = '🧑'
    
    # Warning triangle
    'ðŸ' = '⚠️'
    'ðŸ' = '⚠️'
    
    # Speaker
    'ðŸ' = '🔊'
    'ðŸ' = '🔊'
    
    # Mute
    'ðŸ' = '🔇'
    'ðŸ' = '🔇'
    
    # Unlocked
    'ðŸ' = '🔓'
    'ðŸ' = '🔓'
    
    # Shield
    'ðŸ' = '🛡️'
    'ðŸ' = '🛡️'
    
    # Door
    'ðŸ' = '🚪'
    'ðŸ' = '🚪'
    
    # Fire
    'ðŸ' = '🔥'
    'ðŸ' = '🔥'
    
    # Plug
    'ðŸ' = '🔌'
    'ðŸ' = '🔌'
    
    # Mobile
    'ðŸ' = '📱'
    'ðŸ' = '📱'
    
    # Computer
    'ðŸ' = '💻'
    'ðŸ' = '💻'
    
    # File
    'ðŸ' = '📄'
    'ðŸ' = '📄'
    
    # Chart bar
    'ðŸ' = '📊'
    'ðŸ' = '📊'
    
    # Chart line
    'ðŸ' = '📈'
    'ðŸ' = '📈'
    
    # Trophy
    'ðŸ' = '🏆'
    'ðŸ' = '🏆'
    
    # Save
    'ðŸ' = '💾'
    'ðŸ' = '💾'
    
    # Brain
    'ðŸ' = '🧠'
    'ðŸ' = '🧠'
    
    # Skull
    'ðŸ' = '💀'
    'ðŸ' = '💀'
    
    # Wave
    'ðŸ' = '👋'
    'ðŸ' = '👋'
    
    # Star
    'ðŸ' = '⭐'
    'ðŸ' = '⭐'
    'â­' = '⭐'
    
    # Sun cloud
    'ðŸŒ¤ï¸' = '🌤️'
    'ðŸŒ¤' = '🌤️'
    
    # Sunset
    'ðŸ' = '🌅'
    'ðŸ' = '🌅'
    
    # Moon
    'ðŸ' = '🌙'
    'ðŸ' = '🌙'
    
    # Cloud
    'ðŸ' = '☁️'
    'ðŸ' = '☁️'
    
    # Party
    'ðŸ' = '🎉'
    'ðŸ' = '🎉'
    
    # Paint
    'ðŸ' = '🎨'
    'ðŸ' = '🎨'
    
    # Tools
    'ðŸ' = '🛠️'
    'ðŸ' = '🛠️'
    
    # Maintenance
    'â•±ï¸' = '⏱'
    
    # Stop
    'ðŸ' = '🛑'
    'ðŸ' = '🛑'
    
    # Location
    'ðŸ' = '📍'
    'ðŸ' = '📍'
}

foreach ($key in $replacements.Keys) {
    $content = $content -replace [regex]::Escape($key), $replacements[$key]
}

$content | Out-File "$PSScriptRoot\src\App.jsx" -Encoding UTF8
Write-Host "Fixed emoji encoding issues"
