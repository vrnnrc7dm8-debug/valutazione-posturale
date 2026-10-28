import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EditorErrorBoundaryProps {
  children: ReactNode
  onClose: () => void
  title?: string
}

interface EditorErrorBoundaryState {
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<EditorErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void error
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.error) {
      const { error, errorInfo } = this.state
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6 shadow-2xl"
            role="alert"
          >
            <div className="mb-4 flex items-start gap-3 text-red-700">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
              <div>
                <h2 className="text-lg font-semibold">
                  {this.props.title ?? 'Errore nell’editor annotazioni'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  L’editor non è riuscito ad aprirsi. Dettaglio sotto.
                </p>
              </div>
            </div>
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-800">
              {error.message}
            </pre>
            {errorInfo?.componentStack && (
              <details className="mt-3 text-xs text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-700">
                  Stack componenti
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2">
                  {errorInfo.componentStack.trim()}
                </pre>
              </details>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  this.setState({ error: null, errorInfo: null })
                }
              >
                Riprova
              </Button>
              <Button type="button" onClick={this.props.onClose}>
                <X className="h-4 w-4" />
                Chiudi
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
