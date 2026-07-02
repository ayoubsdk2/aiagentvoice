import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Shield } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SystemErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Silent logging — no console.log in production
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error("[SystemErrorBoundary]", error, info.componentStack);
    }
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-8">
          <div className="glass-card max-w-md w-full p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center">
              <AlertTriangle size={32} className="text-destructive" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                System Recovery Required
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The Phaos Neural Engine encountered an unexpected fault. 
                No data has been lost. Click below to reinitialize the subsystem.
              </p>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <div className="text-left p-3 rounded-lg bg-secondary/50 border border-border/30 font-mono text-[10px] text-muted-foreground max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              <Shield size={10} /> Fault Isolation Active
            </div>

            <button
              onClick={this.handleRecover}
              className="w-full py-3 bg-gradient-phaos text-primary-foreground font-bold uppercase tracking-widest rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-all btn-glow flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Reinitialize System
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
