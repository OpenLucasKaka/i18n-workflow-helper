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
  if (isLikelyCodeToken(trimmed)) {
    return false;
  }
  if (/^[A-Z0-9_.-]+$/.test(trimmed)) {
    return false;
  }
  return /[\p{L}]/u.test(trimmed);
}

export function isLikelyCodeToken(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) {
    return true;
  }

  if (/^(https?:\/\/|\/|\.\/|\.\.\/|#|@)/.test(trimmed)) {
    return true;
  }

  if (/^[a-zA-Z_$][\w$.-]*$/.test(trimmed) && !/[\u4e00-\u9fa5]/.test(trimmed)) {
    if (!/[A-Z]/.test(trimmed) && !/\s/.test(trimmed)) {
      return true;
    }
    if (trimmed.includes('_') || trimmed.includes('.') || trimmed.includes('-')) {
      return true;
    }
  }

  if (/^[a-z0-9/_:-]+$/i.test(trimmed) && /[_/:.-]/.test(trimmed) && !/\s/.test(trimmed)) {
    return true;
  }

  return false;
}

export function suggestKeyFromText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^\w\u4e00-\u9fa5]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');
}

export function suggestNamespaceFromPath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/\.[^.]+$/, '');
  const segments = normalized
    .split('/')
    .filter(Boolean)
    .filter((segment) => !['src', 'app', 'pages', 'components'].includes(segment.toLowerCase()))
    .map((segment) => segment.replace(/[^\w\u4e00-\u9fa5]+/g, '.').replace(/^\.+|\.+$/g, '').toLowerCase())
    .filter(Boolean);

  if (segments[segments.length - 1] === 'index') {
    segments.pop();
  }

  return segments.join('.');
}

export function hasKeyPathConflict(candidate: string, existingKeys: Iterable<string>): boolean {
  const candidateSegments = candidate.split('.').filter(Boolean);
  for (const key of existingKeys) {
    if (key === candidate) {
      continue;
    }

    const keySegments = key.split('.').filter(Boolean);
    const sharedLength = Math.min(candidateSegments.length, keySegments.length);
    let samePrefix = true;

    for (let index = 0; index < sharedLength; index += 1) {
      if (candidateSegments[index] !== keySegments[index]) {
        samePrefix = false;
        break;
      }
    }

    if (samePrefix && sharedLength === candidateSegments.length) {
      return true;
    }

    if (samePrefix && sharedLength === keySegments.length) {
      return true;
    }
  }

  return false;
}

export function expandBraceGlob(pattern: string): string[] {
  const match = pattern.match(/\{([^{}]+)\}/);
  if (!match || match.index === undefined) {
    return [pattern];
  }

  const prefix = pattern.slice(0, match.index);
  const suffix = pattern.slice(match.index + match[0].length);
  return match[1]
    .split(',')
    .flatMap((part) => expandBraceGlob(`${prefix}${part.trim()}${suffix}`));
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/');
  let source = '^';

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    const nextNext = normalized[index + 2];

    if (char === '*') {
      if (next === '*') {
        if (nextNext === '/') {
          source += '(?:.*/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
      continue;
    }

    if (char === '?') {
      source += '[^/]';
      continue;
    }

    source += escapeRegExp(char);
  }

  source += '$';
  return new RegExp(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}
