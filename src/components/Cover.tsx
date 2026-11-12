/** Coloured tile with the game's initials, stable per appid. Images come in a later version. */
export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function hueFor(appid: number) {
  return (appid * 47) % 360;
}

export function Cover({ appid, name, className = "dbx-cover" }: { appid: number; name: string; className?: string }) {
  return (
    <div className={className} style={{ ["--h" as string]: hueFor(appid) }}>
      {className === "dbx-cover" ? initials(name) : name}
    </div>
  );
}
