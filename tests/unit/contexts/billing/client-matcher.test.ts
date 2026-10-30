import { describe, expect, it } from "vitest";
import { matchClient, normalizeName } from "../../../../src/contexts/billing/client-matcher";

const CLIENTS = [
  { id: 1, name: "Administración de los Servicios de Salud del Estado", identifier: "21.000000.0017" },
  { id: 2, name: "Hospital de Clínicas", identifier: "210000000025" },
  { id: 3, name: "Intendencia de Montevideo", identifier: "211763350018" },
  { id: 4, name: "Lab. Pérez S.R.L.", identifier: "217000000011" },
  { id: 5, name: "Hospital Maciel", identifier: "" },
  { id: 6, name: "Distribuidora Norte S.A.", identifier: "215555550011" },
  { id: 7, name: "Distribuidora Sur S.A.", identifier: "215555550029" },
];

describe("normalizeName", () => {
  it("ignores case, accents, punctuation and legal suffixes", () => {
    expect(normalizeName("Lab. Pérez S.R.L.")).toBe("LAB PEREZ");
    expect(normalizeName("DISTRIBUIDORA NORTE SOCIEDAD ANONIMA")).toBe("DISTRIBUIDORA NORTE");
  });
});

describe("matchClient", () => {
  it("matches by RUT ignoring dots and dashes, even if the name differs", () => {
    expect(matchClient({ clientRut: "210000000017", clientName: "A.S.S.E." }, CLIENTS)).toEqual({ clientId: 1, by: "rut" });
  });

  it("matches by name when there is no RUT", () => {
    expect(matchClient({ clientName: "HOSPITAL DE CLINICAS" }, CLIENTS)).toEqual({ clientId: 2, by: "nombre" });
    expect(matchClient({ clientName: "Laboratorio Perez SRL" }, CLIENTS)).toBeNull();
    expect(matchClient({ clientName: "LAB PEREZ SRL" }, CLIENTS)).toEqual({ clientId: 4, by: "nombre" });
  });

  it("matches an acronym to the full name", () => {
    expect(matchClient({ clientName: "ASSE" }, CLIENTS)).toEqual({ clientId: 1, by: "nombre" });
  });

  it("matches when one name contains the other", () => {
    expect(matchClient({ clientName: "Hospital Maciel - ASSE" }, CLIENTS)).toEqual({ clientId: 5, by: "nombre" });
  });

  it("falls back to the name when the RUT is not loaded in the app", () => {
    expect(matchClient({ clientRut: "219999999999", clientName: "Intendencia de Montevideo" }, CLIENTS)).toEqual({ clientId: 3, by: "nombre" });
  });

  it("leaves it unlinked when it is ambiguous or unknown", () => {
    expect(matchClient({ clientName: "Distribuidora" }, CLIENTS)).toBeNull();
    expect(matchClient({ clientName: "Hospital" }, CLIENTS)).toBeNull();
    expect(matchClient({ clientName: "Ministerio de Defensa" }, CLIENTS)).toBeNull();
    expect(matchClient({}, CLIENTS)).toBeNull();
  });
});
