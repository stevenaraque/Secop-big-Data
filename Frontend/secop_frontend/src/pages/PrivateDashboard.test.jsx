import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import PrivateDashboard from "./PrivateDashboard.jsx";
import App from "../App.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPrivate(ui) {
  return render(<QueryClientProvider client={client()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PrivateDashboard", () => {
  it("renderiza form radar + bandeja vacía", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], count: 0 }) });

    renderPrivate(<PrivateDashboard token="t" />);

    expect(screen.getByText("Nuevo Radar")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("pavimento")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Mis Radares (0)")).toBeInTheDocument();
      expect(screen.getByText(/sin oportunidades/i)).toBeInTheDocument();
    });
  });

  it("rechaza filtros_extras no-JSON sin POST", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], count: 0 }) });

    renderPrivate(<PrivateDashboard token="t" />);

    fireEvent.change(screen.getByPlaceholderText("pavimento"), { target: { value: "puente" } });
    fireEvent.change(screen.getByPlaceholderText('{"orden":"1"}'), {
      target: { value: "{no-json" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crear radar/i }));

    await waitFor(() => {
      expect(screen.getByText(/JSON inválido/i)).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("crea radar con POST y confirma mensaje", async () => {
    global.fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [], count: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 9 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ id: 9 }] }) });

    renderPrivate(<PrivateDashboard token="t" />);

    fireEvent.change(screen.getByPlaceholderText("pavimento"), { target: { value: "puente" } });
    fireEvent.click(screen.getByRole("button", { name: /crear radar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/radares/"),
        expect.objectContaining({ method: "POST" })
      );
      expect(screen.getByText(/Radar creado/)).toBeInTheDocument();
    });
  });
});

describe("App guard", () => {
  it("sin token redirige a login", async () => {
    // App usa BrowserRouter interno: se entra a /app vía historial (ruta privada, no la pública /)
    window.history.pushState({}, "", "/app");
    render(
      <QueryClientProvider client={client()}>
        <App />
      </QueryClientProvider>
    );
    await waitFor(
      () => {
        expect(screen.getByRole("heading", { name: /iniciar sesi/i })).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    window.history.pushState({}, "", "/");
  });
});
