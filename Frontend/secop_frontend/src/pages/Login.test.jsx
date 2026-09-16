import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Login from "./Login.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function renderWithProviders(ui) {
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renderiza formulario de login con campos requeridos", () => {
  renderWithProviders(<Login />);
  expect(screen.getByLabelText("Correo")).toBeInTheDocument();
  expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
});

test("hace POST a /api/auth/login/ y guarda tokens al enviar válido", async () => {
  const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
  const mockRefresh = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh";

  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access: mockToken, refresh: mockRefresh }),
  });

  renderWithProviders(<Login />);

  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "test@test.com" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "Password123" },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/login/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: "test@test.com", contrasena: "Password123" }),
      })
    );
  });

  await waitFor(() => {
    expect(localStorage.getItem("access")).toBe(mockToken);
    expect(localStorage.getItem("refresh")).toBe(mockRefresh);
  });
});

test("muestra error si credenciales inválidas", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ detalle: "Credenciales inválidas." }),
  });

  renderWithProviders(<Login />);

  fireEvent.change(screen.getByLabelText("Correo"), {
    target: { value: "test@test.com" },
  });
  fireEvent.change(screen.getByLabelText("Contraseña"), {
    target: { value: "wrong" },
  });
  fireEvent.click(screen.getByRole("button", { name: /entrar/i }));

  await waitFor(() => {
    expect(screen.getByRole("alert")).toHaveTextContent("Credenciales inválidas.");
  });
});