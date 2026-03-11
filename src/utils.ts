export function buildNestedObject(path: string, value: string): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  const segments = path.split('.').filter(Boolean);
  let current = root;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      current[segment] = value;
      return;
    }
    current[segment] = {};
    current = current[segment] as Record<string, unknown>;
  });
  return root;
}

export function flattenObject(
  value: unknown,
  prefix = '',
  result: Record<string, string> = {}
): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      result[nextKey] = child;
      continue;
    }
    flattenObject(child, nextKey, result);
  }

  return result;
}

export function stripQuotes(input: string): string {
  if (
    (input.startsWith('"') && input.endsWith('"')) ||
    (input.startsWith("'") && input.endsWith("'")) ||
    (input.startsWith('`') && input.endsWith('`'))
  ) {
    return input.slice(1, -1);
  }
  return input;
}

export function isNaturalLanguage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) {
    return false;
  }
  if (/^[A-Z0-9_.-]+$/.test(trimmed)) {
    return false;
  }
  return /[\p{L}]/u.test(trimmed);
}
