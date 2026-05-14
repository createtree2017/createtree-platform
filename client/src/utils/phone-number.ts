const NON_DIGIT_PATTERN = /\D/g;

export function normalizePhoneNumberInput(value: string | null | undefined): string {
  return (value || "").replace(NON_DIGIT_PATTERN, "").slice(0, 11);
}

export function formatPhoneNumber(value: string | null | undefined): string {
  const digits = normalizePhoneNumberInput(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.startsWith("02")) {
    if (digits.length <= 5) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, digits.length - 4)}-${digits.slice(-4)}`;
    }

    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}
