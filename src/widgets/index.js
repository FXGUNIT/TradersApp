// Widgets layer - Composite UI components that combine multiple entities/features
// Widgets are reusable across pages and represent complex UI blocks

// TODO: Migrate composite components from App.jsx and components/ to widgets/
// Target widgets to extract:
// - MegaMenu
// - CommandPalette
// - NotificationCenter
// - DebugOverlay
// - MaintenanceScreen
// - SupportChatModal

export const WIDGETS = {
  // Will be populated during Phase 4: Widgets & Pages Assembly
};

// Widget utilities
export function registerWidget(name, component) {
  WIDGETS[name] = component;
  console.log(`Widget registered: ${name}`);
}
