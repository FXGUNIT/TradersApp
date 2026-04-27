import React from "react";

export default class ErrorBoundaryAdmin extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AdminDashboard Error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    window.dispatchEvent(
      new CustomEvent("dashboardError", {
        detail: {
          error: error.toString(),
          componentStack: errorInfo.componentStack,
        },
      }),
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "var(--surface-base, #F9FAFB)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-ui)",
            padding: 20,
          }}
        >
          <div
            style={{
              maxWidth: 540,
              textAlign: "center",
              padding: 40,
              background: "rgba(255,67,54,0.1)",
              border: "2px solid rgba(255,67,54,0.3)",
              borderRadius: 12,
            }}
            className="glass-panel"
          >
            <div style={{ fontSize: 48, marginBottom: 20 }}>!</div>
            <div
              style={{
                color: "#FF4336",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              DASHBOARD ERROR
            </div>
            <div
              style={{
                color: "var(--text-secondary, #A1A1A6)",
                fontSize: 14,
                lineHeight: 1.8,
                marginBottom: 20,
              }}
            >
              The dashboard encountered an unexpected error. Please try
              refreshing the page.
            </div>
            {this.state.error && (
              <div
                style={{
                  background: "rgba(0,0,0,0.5)",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 20,
                  textAlign: "left",
                  fontSize: 11,
                  color: "#FFF",
                  fontFamily: "monospace",
                  maxHeight: 120,
                  overflow: "auto",
                }}
              >
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "var(--accent-primary, #2563EB)",
                border: "none",
                borderRadius: 6,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#FFFFFF",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.05em",
                padding: "0 18px",
              }}
              className="btn-glass"
            >
              REFRESH PAGE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
