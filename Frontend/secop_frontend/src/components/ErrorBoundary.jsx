import { Component } from "react";

// P1: un crash en 1 sección (Grafo canvas, Mapa leaflet) no tumba todo el dashboard.
// Uso: <ErrorBoundary nombre="Grafo"><Grafo /></ErrorBoundary>
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-6 text-center"
        >
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {this.props.nombre || "Esta sección"} falló al pintar.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 h-9 rounded-full border border-red-300 dark:border-red-800 px-5 text-sm font-medium text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
