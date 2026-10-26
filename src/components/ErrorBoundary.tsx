import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  private static isExtensionError(error: any): boolean {
    if (!error) return false;
    const msg = ((error?.message || '') + ' ' + (error?.stack || '') + ' ' + String(error)).toLowerCase();
    return (
      msg.includes('sender-wallet') ||
      msg.includes('sender_getproviderstate') ||
      msg.includes('no account exist') ||
      msg.includes('failed to get initial state') ||
      msg.includes('sender:') ||
      msg.includes('removechild') ||
      msg.includes('not a child of this node') ||
      msg.includes('insertbefore')
    );
  }

  public static getDerivedStateFromError(error: Error): State {
    if (ErrorBoundary.isExtensionError(error)) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (ErrorBoundary.isExtensionError(error)) {
      return;
    }
    console.error('Application error caught by boundary:', error, errorInfo);
  }

  public handleReset = () => {
    localStorage.removeItem('funnelcraft_page_draft');
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6 text-gray-900">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 text-center space-y-4">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black">Something went wrong</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              An unexpected error occurred. Click below to reload with the default high-converting template.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Workspace</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
