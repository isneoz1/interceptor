/* Ecriture de fichier depuis la page d arriere-plan — INTERCEPTOR (by NeoZ)
 *
 * L export est construit et telecharge ici, jamais dans la popup : une popup se
 * ferme des qu elle perd le focus, ce qui revoquerait l URL du blob en pleine
 * ecriture. La page d arriere-plan etant persistante, le telechargement aboutit
 * toujours.
 */
import { B } from '../lib/util.js';

export const saveStats = { files: 0, bytes: 0, failed: 0 };

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
         '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

export async function saveFile(baseName, extension, content, mime) {
  const filename = 'interceptor-' + baseName + '-' + stamp() + '.' + extension;
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const id = await B.downloads.download({ url, filename, saveAs: true });
    saveStats.files++;
    saveStats.bytes += blob.size;

    // L URL n est liberee qu une fois l ecriture terminee ou annulee.
    const release = delta => {
      if (delta.id !== id) return;
      const done = (delta.state && delta.state.current !== 'in_progress') || delta.error;
      if (!done) return;
      B.downloads.onChanged.removeListener(release);
      URL.revokeObjectURL(url);
    };
    B.downloads.onChanged.addListener(release);
    setTimeout(() => {
      try { B.downloads.onChanged.removeListener(release); } catch {}
      URL.revokeObjectURL(url);
    }, 120000);

    return { ok: true, filename, bytes: blob.size };
  } catch (e) {
    saveStats.failed++;
    URL.revokeObjectURL(url);
    return { ok: false, error: String(e && e.message || e) };
  }
}
