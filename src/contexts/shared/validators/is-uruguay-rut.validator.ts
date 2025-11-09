import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * Valida que un RUT uruguayo tenga el formato correcto y dígito verificador válido
 * Formato esperado: XXXXXXXX-X (8 dígitos seguidos de guion y dígito verificador)
 */
@ValidatorConstraint({ name: "isUruguayRut", async: false })
export class IsUruguayRutConstraint implements ValidatorConstraintInterface {
  validate(rut: string): boolean {
    if (!rut || typeof rut !== "string") {
      return false;
    }

    // Remover espacios y convertir a mayúsculas
    const cleanRut = rut.trim().toUpperCase();

    // Validar formato básico: debe tener guion y formato correcto
    const rutRegex = /^(\d{1,2}\.?\d{3}\.?\d{3})-?(\d|K)$/;
    if (!rutRegex.test(cleanRut)) {
      return false;
    }

    // Extraer número y dígito verificador
    const rutWithoutDots = cleanRut.replace(/\./g, "");
    const parts = rutWithoutDots.split("-");
    
    if (parts.length !== 2) {
      // Si no tiene guion, intentar separar los últimos caracteres
      if (rutWithoutDots.length < 8 || rutWithoutDots.length > 9) {
        return false;
      }
      const numberPart = rutWithoutDots.slice(0, -1);
      const checkDigit = rutWithoutDots.slice(-1);
      return this.validateCheckDigit(numberPart, checkDigit);
    }

    const [numberPart, checkDigit] = parts;

    // Validar que el número tenga entre 7 y 8 dígitos
    if (numberPart.length < 7 || numberPart.length > 8) {
      return false;
    }

    return this.validateCheckDigit(numberPart, checkDigit);
  }

  defaultMessage(): string {
    return "RUT must be a valid Uruguayan RUT format (XXXXXXXX-X) with valid check digit";
  }

  /**
   * Valida el dígito verificador del RUT uruguayo
   * Algoritmo: Se multiplican los dígitos por la secuencia 2, 9, 8, 7, 6, 3, 4
   * Se suman los productos, se divide por 11 y se toma el resto
   * El dígito verificador es 11 menos el resto (si es 11, se usa 0; si es 10, se usa K)
   */
  private validateCheckDigit(numberPart: string, checkDigit: string): boolean {
    // Asegurar que el número tenga 8 dígitos (rellenar con ceros a la izquierda si es necesario)
    const paddedNumber = numberPart.padStart(8, "0");

    // Secuencia de multiplicadores para RUT uruguayo
    const multipliers = [2, 9, 8, 7, 6, 3, 4];

    // Calcular suma de productos
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(paddedNumber[i], 10);
      sum += digit * multipliers[i];
    }

    // Calcular dígito verificador esperado
    const remainder = sum % 11;
    let expectedCheckDigit: string;

    if (remainder === 0) {
      expectedCheckDigit = "0";
    } else if (remainder === 1) {
      expectedCheckDigit = "K";
    } else {
      expectedCheckDigit = (11 - remainder).toString();
    }

    // Comparar con el dígito verificador proporcionado
    return checkDigit.toUpperCase() === expectedCheckDigit;
  }
}

/**
 * Decorator para validar RUT uruguayo
 * @param validationOptions Opciones de validación de class-validator
 */
export function IsUruguayRut(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUruguayRutConstraint,
    });
  };
}

