const hues = [78, 163, 287, 28, 220, 340];
export function memberIdentity(name: string) {
  const normalized = name.trim().toLocaleLowerCase("en-IN");
  const hash = Array.from(normalized).reduce(
    (value, char) => (value * 31 + char.charCodeAt(0)) >>> 0,
    0,
  );
  return {
    color: `oklch(0.78 0.12 ${hues[hash % hues.length]})`,
    initials:
      name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part.charAt(0))
        .join("")
        .toUpperCase() || "?",
  };
}
