// App layer - Application initialization, routing, and providers
// This is the entry point for the application layer

export { default as App } from "../App.jsx";
export { default as MainRouter } from "./routing/MainRouter.jsx";

// Providers
export { UserListProvider } from "./providers/UserListProvider.jsx";
export { ThemeProvider } from "./providers/ThemeProvider.jsx";

// Styles
export { GlobalStyles } from "./styles/GlobalStyles.jsx";

// App layer constants
export const APP_NAME = "TradersApp";
export const APP_VERSION = "0.0.0";
