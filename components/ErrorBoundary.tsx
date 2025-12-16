import React from "react";

interface ErrorBoundaryProps {
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("UI ErrorBoundary caught:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{ 
          padding: 12, 
          backgroundColor: '#1a1a1a', 
          color: '#888',
          borderRadius: 8,
          textAlign: 'center',
          fontSize: 14
        }}>
          Something went wrong in this panel.
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

