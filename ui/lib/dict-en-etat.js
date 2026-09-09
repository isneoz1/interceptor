/* Dictionnaire anglais — vue « Etat du systeme » — INTERCEPTOR (by NeoZ)
 *
 * Cette vue lit ses chiffres dans le noyau et les pose dans des tables :
 * grid([['Libelle', valeur]]). Le texte vit donc dans une donnee, pas dans
 * l appel, et le controle de couverture ne le voyait pas — la vue entiere
 * restait en francais quand l interface passait en anglais.
 *
 * On y trouve aussi les gabarits des valeurs composees. Une valeur assemblee
 * par concatenation ne peut correspondre a aucune cle : « oui · API oui » se
 * construit a l execution. tp() traduit le gabarit puis remplit les trous.
 */
export const EN_ETAT = {
  /* ---------------------------------- Etats ------------------------------- */
  /* « oui » / « non » vivent dans dict-en-panneaux.js, « En attente du noyau »,
     « Purger le stockage » et « Confirmer la purge ? » dans dict-en.js : une
     cle ne se definit qu a un seul endroit. */
  'disponible': 'available',
  'indisponible': 'unavailable',
  'desactive': 'off',
  'desactivee': 'off',
  'CAPTURE ACTIVE': 'CAPTURING',
  'EN PAUSE': 'PAUSED',
  'Connexion en cours…': 'Connecting…',

  /* ------------------------------- Extension ------------------------------ */
  'Auteur': 'Author',
  'Actif depuis': 'Running for',

  /* ------------------------------ Anti-doublon ---------------------------- */
  'Fusions realisees': 'Merges performed',
  'Signatures suivies': 'Signatures tracked',
  'Cles URL': 'URL keys',
  'Observations en attente': 'Observations waiting',
  'Fenetre de correlation': 'Correlation window',
  'Balayage': 'Sweep interval',

  /* --------------------------- Corps de reponse --------------------------- */
  'StreamFilter': 'StreamFilter',
  'Point d ancrage': 'Anchor point',
  'Corps captures': 'Bodies captured',
  'Reponses simulees': 'Responses mocked',
  'Echecs': 'Failures',
  'Filtres actifs': 'Filters active',

  /* -------------------------- Sondes du monde page ------------------------ */
  'Evenements recus': 'Events received',
  'Fusionnes': 'Merged',
  'Promus en ligne autonome': 'Promoted to their own row',
  'Trames et messages': 'Frames and messages',

  /* ---------------------------- Etat des couches -------------------------- */
  'webRequest (9 evenements)': 'webRequest (9 events)',
  'Corps de reponse (StreamFilter)': 'Response bodies (StreamFilter)',
  'Proxy (facultatif)': 'Proxy (optional)',
  'Piles JavaScript': 'JavaScript stacks',
  'WebTransport': 'WebTransport',
  'Decompression gzip / deflate': 'gzip / deflate decompression',
  'Persistance IndexedDB': 'IndexedDB persistence',
  'Notifications bureau': 'Desktop notifications',
  'Rejeu autorise': 'Replay allowed',

  /* ------------------------ Couches complementaires ----------------------- */
  'TLS interroges': 'TLS queried',
  'TLS en echec': 'TLS failed',
  'DNS resolus': 'DNS resolved',
  'DNS en echec': 'DNS failed',
  'Regles : latence': 'Rules: latency',
  'Regles : substitutions': 'Rules: replacements',
  'Fichiers exportes': 'Files exported',
  'Persistance': 'Persistence',

  /* --------------------------- Analyse automatique ------------------------ */
  'Requetes analysees': 'Requests analysed',
  'Motifs personnels': 'Custom patterns',
  'Pisteurs ajoutes': 'Extra trackers',

  /* ------------------------- Gabarits des valeurs ------------------------- */
  '{r} · API {a}': '{r} · API {a}',
  '{r} · {n} evenements': '{r} · {n} events',
  '{r} · {n} trames': '{r} · {n} frames',
  '{r} · {n} regle(s)': '{r} · {n} rule(s)',
  '{n} (cache {c})': '{n} (cached {c})',
  '{n} observations': '{n} observations',
  '{b} bloquees · {r} redirigees · {h} forcees en https · {e} entetes · {s} simulees':
    '{b} blocked · {r} redirected · {h} forced to https · {e} headers · {s} mocked',
  '{n} retardees · {d} au total': '{n} delayed · {d} in total',
  '{a} appliquees · {e} ecartees': '{a} applied · {e} skipped',
  '{e} envoyes · {f} echoues': '{e} sent · {f} failed',
  '{n} ({t})': '{n} ({t})',
  '{e} ecrits · {r} restaures': '{e} written · {r} restored',
  '{n} nav · {c} cookies · {x} contexte': '{n} nav · {c} cookies · {x} context',

  /* ---------------------- Couverture et stockage -------------------------- */
  'Motifs personnels invalides, ignores : {liste}': 'Invalid custom patterns, ignored: {liste}',
  'Declenche de vraies requetes depuis l onglet actif, vers sa propre origine uniquement : fetch GET, fetch POST avec corps, XMLHttpRequest, image, sendBeacon, EventSource, WebSocket et balise script. Aucun service externe n est contacte.':
    'Fires real requests from the active tab, to its own origin only: fetch GET, fetch POST with a body, XMLHttpRequest, image, sendBeacon, EventSource, WebSocket and a script tag. No external service is contacted.',
  'La persistance ecrit les requetes terminees dans IndexedDB, local a Firefox. Elle se regle dans Reglages -> Stockage.':
    'Persistence writes finished requests to IndexedDB, local to Firefox. It is configured under Settings -> Storage.',
  'Base vide (la persistance est-elle activee ?).': 'Database empty (is persistence turned on?).',
  '{n} enregistrement(s) sur disque.': '{n} record(s) on disk.',
  'Purge impossible': 'Purge failed',
  'Base videe. La capture en memoire est conservee.':
    'Database emptied. The in-memory capture is kept.',
  'Injection des sondes en cours…': 'Injecting the probes…',
  '{n} sondes emises': '{n} probes fired',
  '{n} sondes emises sur {url} — {d} nouvelles lignes capturees. ({liste})':
    '{n} probes fired at {url} — {d} new rows captured. ({liste})'
};
