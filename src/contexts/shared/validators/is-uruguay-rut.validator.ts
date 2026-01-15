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

    // Remover todo lo que no sea dígito
    const cleanRut = rut.replace(/[^0-9]/g, "");

    // RUT debe tener 12 dígitos
    if (cleanRut.length !== 12) {
      return false;
    }

    return this.validateCheckDigit(cleanRut);
  }

  defaultMessage(): string {
    return "RUT must be a valid Uruguayan RUT format (12 digits) with valid check digit";
  }

  /**
   * Valida el dígito verificador del RUT uruguayo (12 dígitos)
   */
  private validateCheckDigit(rut: string): boolean {
    const digits = rut.split("").map(Number);
    const verifier = digits.pop(); // El último dígito es el verificador
    
    // Factores para RUT de 12 dígitos (primeros 11 dígitos)
    const factors = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let total = 0;
    for (let i = 0; i < factors.length; i++) {
      total += digits[i] * factors[i];
    }

    const remainder = total % 11;
    let computedVerifier = 11 - remainder;

    if (computedVerifier === 11) {
      computedVerifier = 0;
    }

    // Si el resultado es 10, el RUT es inválido
    if (computedVerifier === 10) {
      return false;
    }

    return computedVerifier === verifier;
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

