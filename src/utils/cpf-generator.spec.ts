import { generateCpf } from './cpf-generator';

function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (parseInt(digits[9]) !== d1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  if (parseInt(digits[10]) !== d2) return false;

  return true;
}

describe('generateCpf', () => {
  it('should return a string in the format XXX.XXX.XXX-XX', () => {
    const cpf = generateCpf();
    expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });

  it('should generate a CPF with valid check digits', () => {
    for (let i = 0; i < 20; i++) {
      const cpf = generateCpf();
      expect(isValidCpf(cpf)).toBe(true);
    }
  });

  it('should generate different CPFs on multiple calls', () => {
    const cpfs = new Set<string>();
    for (let i = 0; i < 50; i++) {
      cpfs.add(generateCpf());
    }
    expect(cpfs.size).toBeGreaterThan(1);
  });
});
