import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, beforeEach, afterEach, vi } from "vitest";
import Registro from "./Registro.jsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function renderWithProviders(ui) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("renderiza formulario de registro con 4 campos requeridos", async () => {
  renderWithProviders(<Registro />);
  // espera a que pase el checked loader (P0-1)
  await waitFor(() => expect(screen.getByLabelText("Nombre de usuario")).toBeInTheDocument());
  expect(screen.getByLabelText("Correo")).toBeInTheDocument();
  expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  expect(screen.getByLabelText("Confirmar contraseña")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /crear cuenta/i })).toBeInTheDocument();
});

test("valida contraseñas no coinciden sin hacer POST", async () => {
  renderWithProviders(<Registro />);
  await waitFor(() => expect(screen.getByLabelText("Nombre de usuario")).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "andina_sas" } });
  fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "test@empresa.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Test1234A" } });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Otra1234A" } });
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

  await waitFor(() => {
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Las contraseñas no coinciden");
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

test("hace POST a /api/auth/register/ y muestra ok al enviar válido", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 1, nombre_usuario: "andina_sas", correo: "test@empresa.com" }),
  });

  renderWithProviders(<Registro />);
  await waitFor(() => expect(screen.getByLabelText("Nombre de usuario")).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "andina_sas" } });
  fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "test@empresa.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Test1234A" } });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Test1234A" } });
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/auth/register/",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_usuario: "andina_sas", correo: "test@empresa.com", contrasena: "Test1234A" }),
      })
    );
  });

  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("Cuenta creada");
  });
});

test("muestra error si correo ya existe", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ correo: ["El correo ya está registrado."] }),
  });

  renderWithProviders(<Registro />);
  await waitFor(() => expect(screen.getByLabelText("Nombre de usuario")).toBeInTheDocument());

  fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "andina_sas" } });
  fireEvent.change(screen.getByLabelText("Correo"), { target: { value: "duplicado@empresa.com" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Test1234A" } });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Test1234A" } });
  fireEvent.click(screen.getByRole("button", { name: /crear cuenta/i }));

  await waitFor(() => {
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("El correo ya está registrado");
  });
});
