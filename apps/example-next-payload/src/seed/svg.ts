/** A flat, dependency-free placeholder picture: two soft shapes on a tinted background. */
export function placeholderSvg(hue: number, label: string): string {
  const safe = label.replace(/[<>&"']/g, '');
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" role="img">',
    `<title>${safe}</title>`,
    `<rect width="1200" height="800" fill="hsl(${hue} 60% 92%)"/>`,
    `<circle cx="380" cy="360" r="220" fill="hsl(${hue} 55% 70%)"/>`,
    `<rect x="620" y="300" width="380" height="300" rx="36" fill="hsl(${(hue + 40) % 360} 50% 55%)"/>`,
    '</svg>',
  ].join('');
}
