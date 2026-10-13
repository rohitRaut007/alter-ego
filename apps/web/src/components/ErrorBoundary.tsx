import { Component, type ReactNode } from "react";

/** Last-resort boundary so a render error never leaves a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // componentDidCatch is deliberately omitted: error content is not logged because pages can
  // contain personal text. getDerivedStateFromError is enough to show the recovery screen.

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            This page did not load
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Something went wrong on our side. You can try again or return to the start.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => this.setState({ failed: false })}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
