const cache: Record<string, string | null> = {};

export function getCached(songPath: string): string | null | undefined {
  return cache[songPath];
}

export function setCached(songPath: string, data: string | null): void {
  cache[songPath] = data;
}
