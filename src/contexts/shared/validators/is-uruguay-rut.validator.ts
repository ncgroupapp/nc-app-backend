import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

/**
 * Valida que un RUT uruguayo tenga el formato correcto y dígito verificador válido
 * Formato esperado: 12 dígitos (puede incluir guiones y espacios que serán ignorados)
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

  defaultMessage(args: ValidationArguments): string {
    const rut = args.value;
    if (!rut || typeof rut !== "string") {
      return "RUT must be a string";
    }

    const cleanRut = rut.replace(/[^0-9]/g, "");
    if (cleanRut.length !== 12) {
      return "RUT must be 12 digits long";
    }

    const base = cleanRut.substring(0, 11);
    const expected = this.calculateCheckDigit(base);
    
    return `Invalid check digit. For the base ${base}, expected ${expected}`;
  }

  /**
   * Valida el dígito verificador del RUT uruguayo (12 dígitos)
   */
  private validateCheckDigit(rut: string): boolean {
    const digits = rut.split("").map(Number);
    const verifier = digits.pop(); // El último dígito es el verificador
    const base = rut.substring(0, 11);
    
    const computedVerifier = this.calculateCheckDigit(base);

    // Si el resultado es 10 (null), el RUT es inválido
    if (computedVerifier === null) {
      return false;
    }

    return computedVerifier === verifier;
  }

  private calculateCheckDigit(base: string): number | null {
    const digits = base.split("").map(Number);
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
    return computedVerifier === 10 ? null : computedVerifier;
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

