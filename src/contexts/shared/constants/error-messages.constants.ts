export const ERROR_MESSAGES = {
  AUTH: {
    USER_NOT_FOUND: 'Usuario no encontrado',
    INVALID_PASSWORD: 'La contraseña es incorrecta',
    REFRESH_TOKEN_NOT_FOUND: 'Refresh token no encontrado',
    NO_TOKEN_PROVIDED: 'No se ha proporcionado token',
    INVALID_TOKEN: 'Token inválido',
  },
  USERS: {
    NOT_FOUND: (id: string | number) => `Usuario con ID ${id} no encontrado`,
    ALREADY_EXISTS: 'El usuario ya existe',
  },
  CLIENTS: {
    NOT_FOUND: (id: string | number) => `Cliente con ID ${id} no encontrado`,
    NAME_ALREADY_EXISTS: (name: string) => `El cliente con nombre ${name} ya existe`,
    IDENTIFIER_ALREADY_EXISTS: (identifier: string) => `El cliente con identificador ${identifier} ya existe`,
  },
  PROVIDERS: {
    NOT_FOUND: (id: string | number) => `Proveedor con ID ${id} no encontrado`,
    NOT_FOUND_MANY: (ids: string) => `Proveedores con IDs [${ids}] no encontrados`,
    ALREADY_EXISTS: (rut: string) => `El proveedor con RUT ${rut} ya existe`,
    HAS_ASSOCIATED_PRODUCTS: "No se puede eliminar el proveedor porque tiene productos asociados.",
    INVALID_RUT_LENGTH: "El RUT debe tener 12 dígitos.",
    INVALID_RUT: "El RUT calculado es inválido.",
    INVALID_RUT_DIGIT: "El RUT proporcionado no es válido (dígito verificador incorrecto).",
  },
  PRODUCTS: {
    NOT_FOUND: (id: string | number) => `Producto con ID ${id} no encontrado`,
    NOT_FOUND_MANY: (ids: string) => `Productos con IDs [${ids}] no encontrados`,
    CANNOT_DELETE_HAS_OFFERS: "No se puede eliminar el producto porque está en una oferta.",
  },
  OFFERS: {
    NOT_FOUND: (id: string | number) => `Oferta con ID ${id} no encontrada`,
  },
  LICITATIONS: {
    NOT_FOUND: (id: string | number) => `Licitación con ID ${id} no encontrada`,
    INVALID_DATE_RANGE: "Rango de fechas inválido: la fecha límite debe ser posterior a la fecha de inicio",
    PRODUCT_REQUIRED: "Se requiere al menos un producto para crear una licitación",
  },
  MANUALS: {
    NOT_FOUND: (id: string | number) => `Manual con ID ${id} no encontrado`,
  },
  QUOTATION: {
    NOT_FOUND: (id: string | number) => `Cotización con ID ${id} no encontrada`,
    IDENTIFIER_ALREADY_EXISTS: (id: string) => `Ya existe una cotización con el identificador: ${id}`,
    IDENTIFIER_NOT_FOUND: (id: string) => `Cotización con identificador ${id} no encontrada`,
  },
  IMPORTS: {
    NOT_FOUND: (id: string | number) => `Importación con ID ${id} no encontrada`,
  },
  COMMON: {
    NOT_FOUND: 'Recurso no encontrado',
  }
};
