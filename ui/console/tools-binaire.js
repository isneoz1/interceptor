/* Panneau « Binaire » — INTERCEPTOR (by NeoZ)
 *
 * Ce qui n est pas du texte : Protocol Buffers, MessagePack, CBOR, DER et
 * certificats, jeux de caracteres. Le texte de travail est lu en base64 ou en
 * hexadecimal, sauf pour un bloc PEM, qui se colle tel quel.
 */
import { el, frag, kv, sec, add, button, jsonTree } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { base64VersOctets, hexVersOctets, octetsVersHex } from '../lib/bytes.js';
import { decoderProtobuf, decoderMsgpack, decoderCbor, essayerFormats } from '../lib/binaires.js';
import { lireDer, pemVersOctets, resumerCertificat } from '../lib/asn1.js';
import { essayerJeux, reparerMojibake, traceDeMojibake, jeuxDisponibles, decoderAvec } from '../lib/charsets.js';
import { reconnaitreSignature } from '../lib/ref-mime.js';
import { decoderTramesWs, decoderTramesH2, PREFACE_H2, entetesDeTrame } from '../lib/trames.js';
import { TableDynamique } from '../lib/hpack.js';

/** Le texte de travail vu comme des octets : hexadecimal d abord, sinon base64. */
function octetsDuTexte(entree) {
  const brut = String(entree || '').trim();
  if (!brut) throw new Error('texte de travail vide');
  const sansEspace = brut.replace(/[\s:,-]+/g, '');
  if (/^(0x)?[0-9a-fA-F]+$/.test(sansEspace) && sansEspace.replace(/^0x/, '').length % 2 === 0) {
    return { octets: hexVersOctets(brut), forme: 'hexadecimal' };
  }
  return { octets: base64VersOctets(brut), forme: 'base64' };
}

/* -------------------------- Arbre d un decodage --------------------------- */
function arbreProtobuf(champs, profondeur = 0) {
  const box = el('div', { class: 'tree' });
  for (const champ of champs) {
    const titre = 'champ ' + champ.numero + '  ·  ' + champ.typeNom +
      (champ.octets != null ? '  ·  ' + champ.octets + ' octets' : '');
    if (champ.enfants) {
      const bloc = el('details', { open: profondeur < 2 });
      bloc.appendChild(el('summary', { text: titre }));
      bloc.appendChild(arbreProtobuf(champ.enfants, profondeur + 1));
      box.appendChild(bloc);
      continue;
    }
    const ligne = el('div', { class: 'row' }, [
      el('span', { class: 'k', text: titre + ' :' }),
      el('span', { class: 'v', text: String(champ.valeur) })
    ]);
    box.appendChild(ligne);
    if (champ.lectures) {
      const autres = Object.entries(champ.lectures)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => k + ' = ' + v).join('   ·   ');
      if (autres) box.appendChild(el('div', { class: 'row' }, el('span', { class: 't', text: autres })));
    }
  }
  return box;
}

export function panneauBinaire(entree, etat, redessiner, poser) {
  const box = frag();
  const famille = etat.familleBinaire || 'auto';

  box.appendChild(sec('Binaire', 'le texte de travail est lu en base64 ou en hexadecimal'));
  const onglets = el('div', { class: 'actions' });
  for (const [cle, libelle] of [
    ['auto', 'Reconnaitre'], ['protobuf', 'Protocol Buffers'], ['msgpack', 'MessagePack'],
    ['cbor', 'CBOR'], ['der', 'ASN.1 et certificats'], ['charset', 'Jeux de caracteres'],
    ['trames', 'Trames WebSocket et HTTP/2']
  ]) {
    onglets.appendChild(button(libelle, () => { etat.familleBinaire = cle; redessiner(); },
      { class: famille === cle ? 'on' : 'ghost' }));
  }
  box.appendChild(onglets);

  if (famille === 'der') return ecrireDer(box, entree, etat, redessiner);

  let lecture;
  try { lecture = octetsDuTexte(entree); }
  catch (e) {
    box.appendChild(el('p', { class: 'note', text: t('Rien a lire : ') + String(e.message || e) }));
    return box;
  }
  const { octets, forme } = lecture;
  add(box, kv('Octets lus', octets.length + '  (' + t(forme) + ')', { always: true }));
  add(box, kv('Premiers octets', octetsVersHex(octets.subarray(0, 16), ' ')));

  const signatures = reconnaitreSignature(octets);
  if (signatures.length) {
    add(box, kv('Signature de fichier', signatures[0].nom + '  ·  ' + signatures[0].type, { hl: true }));
  }

  if (famille === 'charset') return ecrireCharsets(box, octets, entree, etat, redessiner, poser);
  if (famille === 'trames') return ecrireTrames(box, octets, etat, redessiner, poser);

  const rendre = (nom, fn) => {
    try {
      const valeur = fn(octets);
      box.appendChild(sec(nom, 'decode sans reste'));
      if (nom === 'Protocol Buffers') box.appendChild(arbreProtobuf(valeur));
      else box.appendChild(el('div', { class: 'tree' }, jsonTree(valeur, nom)));
      const texte = nom === 'Protocol Buffers' ? JSON.stringify(valeur, null, 2) : JSON.stringify(valeur, null, 2);
      box.appendChild(el('div', { class: 'actions' }, [
        button('Copier en JSON', () => copy(texte, 'Structure copiee')),
        button('Poser comme texte de travail', () => poser(texte))
      ]));
      return true;
    } catch (e) {
      if (famille !== 'auto') {
        box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + String(e.message || e) }));
      }
      return false;
    }
  };

  if (famille === 'protobuf') rendre('Protocol Buffers', decoderProtobuf);
  else if (famille === 'msgpack') rendre('MessagePack', decoderMsgpack);
  else if (famille === 'cbor') rendre('CBOR', decoderCbor);
  else {
    const trouves = essayerFormats(octets);
    box.appendChild(sec('Formats qui acceptent ces octets', trouves.length));
    if (!trouves.length) {
      box.appendChild(el('p', { class: 'note', text:
        t('Aucun des trois formats ne lit ces octets jusqu au bout. Ce peut etre du texte, une image, ou un format non gere.') }));
    }
    for (const trouve of trouves) {
      box.appendChild(sec(trouve.format, ''));
      if (trouve.format === 'Protocol Buffers') box.appendChild(arbreProtobuf(trouve.valeur));
      else box.appendChild(el('div', { class: 'tree' }, jsonTree(trouve.valeur, trouve.format)));
    }
    if (trouves.length > 1) {
      box.appendChild(el('p', { class: 'note', text:
        t('Plusieurs formats acceptent la meme suite d octets : seule la source dit lequel est le bon.') }));
    }
  }
  return box;
}

/* ------------------------- Trames WebSocket et HTTP/2 --------------------- */
/* Les octets tels qu ils circulent sur le fil. L onglet « Flux » montre les
   messages deja reassembles par le navigateur ; ici on lit la trame elle-meme,
   en-tete compris, ce que le navigateur n expose nulle part. */
function ecrireTrames(box, octets, etat, redessiner, poser) {
  const protocole = etat.protocoleTrame || 'auto';

  const choix = el('div', { class: 'actions' });
  for (const [cle, libelle] of [['auto', 'Reconnaitre'], ['ws', 'WebSocket'], ['h2', 'HTTP/2']]) {
    choix.appendChild(button(libelle, () => { etat.protocoleTrame = cle; redessiner(); },
      { class: protocole === cle ? 'on' : 'ghost' }));
  }
  box.appendChild(choix);

  /* La preface HTTP/2 est le seul marqueur certain au debut d un flux ; sans
     elle on essaie les deux lectures et on garde celle qui va au bout. */
  const commencePreface = texteDesOctets(octets, 24) === PREFACE_H2;
  const ordre = protocole === 'ws' ? ['ws'] : protocole === 'h2' ? ['h2']
    : commencePreface ? ['h2', 'ws'] : ['ws', 'h2'];

  let rendu = false;
  for (const essai of ordre) {
    try {
      if (essai === 'ws') {
        const trames = decoderTramesWs(octets);
        if (!trames.length) throw new Error('aucune trame WebSocket lisible');
        ecrireTramesWs(box, trames, poser);
      } else {
        const trames = decoderTramesH2(octets);
        if (!trames.length) throw new Error('aucune trame HTTP/2 lisible');
        ecrireTramesH2(box, trames);
      }
      rendu = true;
      break;
    } catch (e) {
      if (protocole !== 'auto') {
        box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + String(e.message || e) }));
        rendu = true;
        break;
      }
    }
  }
  if (!rendu) {
    box.appendChild(el('p', { class: 'note', text:
      t('Ces octets ne se lisent ni comme des trames WebSocket ni comme des trames HTTP/2.') }));
  }
  return box;
}

/** Les n premiers octets lus comme du texte, pour reconnaitre la preface. */
function texteDesOctets(octets, n) {
  if (octets.length < n) return '';
  let out = '';
  for (let i = 0; i < n; i++) out += String.fromCharCode(octets[i]);
  return out;
}

function ecrireTramesWs(box, trames, poser) {
  box.appendChild(sec('Trames WebSocket', trames.length + ' ' + t('trame(s) lue(s)')));
  for (const [i, tr] of trames.entries()) {
    const douteuse = tr.remarques.some(r => /ne doit pas|ne peut pas|incomplete/.test(r));
    const carte = el('div', { class: 'find ' + (douteuse ? 'warn' : 'info') }, [
      el('h4', { text: '#' + (i + 1) + '   ' + tr.opcodeNom + '   ' + (tr.fin ? 'FIN' : t('fragment')) })
    ]);
    add(carte, kv('Opcode', '0x' + tr.opcode.toString(16) + '  ' + tr.opcodeNom));
    add(carte, kv('Trame finale (FIN)', tr.fin ? t('oui') : t('non')));
    add(carte, kv('Bits reserves RSV1 / RSV2 / RSV3', tr.rsv.join(' / ')));
    add(carte, kv('Masquee', tr.masque ? t('oui') : t('non')));
    add(carte, kv('Cle de masquage', tr.cleMasque || null, { copy: true }));
    add(carte, kv('Longueur annoncee', tr.longueur + '  (' + t(tr.formeLongueur) + ')', { always: true }));
    add(carte, kv('Taille de l en-tete', tr.enteteOctets + ' ' + t('octets'), { always: true }));
    add(carte, kv('Charge utile complete', tr.complete ? t('oui') : t('non')));
    if (tr.fermeture) {
      add(carte, kv('Code de fermeture', tr.fermeture.code, { hl: true }));
      add(carte, kv('Raison', tr.fermeture.raison || null));
    }
    if (tr.texte) carte.appendChild(el('pre', { class: 'pre', text: tr.texte }));
    if (tr.chargeHex) add(carte, kv('Charge utile (hex)', tr.chargeHex, { copy: true }));
    for (const remarque of tr.remarques) {
      carte.appendChild(el('p', { class: 'note', text: t(remarque) }));
    }
    if (tr.texte) {
      carte.appendChild(el('div', { class: 'actions' },
        button('Poser la charge utile comme texte de travail', () => poser(tr.texte))));
    }
    box.appendChild(carte);
  }
}

function ecrireTramesH2(box, trames) {
  box.appendChild(sec('Trames HTTP/2', trames.length + ' ' + t('trame(s) lue(s)')));
  /* Une seule table dynamique pour tout le lot : HPACK apprend d une trame a
     l autre, et un index appris plus tot ne se resout pas sans elle. */
  const tableHpack = new TableDynamique();
  if (trames[0] && trames[0].preface) {
    box.appendChild(el('p', { class: 'note', text:
      t('Preface de connexion HTTP/2 reconnue en tete des octets.') }));
  }
  for (const [i, tr] of trames.entries()) {
    if (tr.vide) continue;
    const carte = el('div', { class: 'find info' }, [
      el('h4', { text: '#' + (i + 1) + '   ' + tr.typeNom + '   ' + t('flux') + ' ' + tr.flux })
    ]);
    add(carte, kv('Type', tr.type + '  ·  ' + tr.typeNom));
    add(carte, kv('Longueur de la charge utile', tr.longueur + ' ' + t('octets'), { always: true }));
    add(carte, kv('Drapeaux', '0x' + tr.drapeaux.toString(16).padStart(2, '0') +
      (tr.drapeauxNoms.length ? '  ·  ' + tr.drapeauxNoms.join(', ') : ''), { always: true }));
    add(carte, kv('Identifiant de flux', tr.flux, { always: true }));
    add(carte, kv('Bit reserve', tr.reserve ? '1 — ' + t('doit etre a zero') : null));
    add(carte, kv('Charge utile complete', tr.complete ? t('oui') : t('non')));
    for (const [cle, valeur] of tr.details) add(carte, kv(cle, valeur));

    /* Le bloc d en-tetes est compresse : sans HPACK il resterait illisible.
       On le decode ici, table dynamique comprise. */
    const lus = entetesDeTrame(tr, tableHpack);
    if (lus) {
      if (lus.erreur) {
        carte.appendChild(el('p', { class: 'note warn',
          text: t('Bloc HPACK illisible : ') + lus.erreur }));
      } else {
        carte.appendChild(sec('En-tetes decodes (HPACK)',
          lus.entetes.length + ' ' + t('en-tete(s)')));
        for (const h of lus.entetes) {
          const ligne = kv(h.nom, h.valeur, { copy: true, always: true });
          if (ligne) ligne.title = t(h.forme) + (h.index ? '  ·  index ' + h.index : '')
            + (h.huffman ? '  ·  Huffman' : '');
          add(carte, ligne);
        }
        add(carte, kv('Table dynamique', lus.tailleTable + ' / ' + lus.tailleMaxTable + ' '
          + t('octets'), { always: true }));
        if (!lus.complet) {
          carte.appendChild(el('p', { class: 'note', text:
            t('END_HEADERS absent : le bloc se poursuit dans une trame CONTINUATION.') }));
        }
      }
    }

    if (tr.chargeHex) add(carte, kv('Charge utile (hex)', tr.chargeHex, { copy: true }));
    box.appendChild(carte);
  }
  if (trames.reliquat && trames.reliquat.length) {
    box.appendChild(el('p', { class: 'note', text:
      trames.reliquat.length + ' ' + t('octet(s) en fin de tampon : plus court qu un en-tete de trame.') }));
  }
}

/* ---------------------------- ASN.1 et X.509 ------------------------------ */
function ecrireDer(box, entree, etat, redessiner) {
  const brut = String(entree || '').trim();
  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Collez un bloc PEM (-----BEGIN CERTIFICATE-----) ou du DER en base64.') }));
    return box;
  }

  let octets, etiquette = 'DER';
  try {
    if (brut.includes('-----BEGIN')) {
      const lu = pemVersOctets(brut);
      octets = lu.octets;
      etiquette = lu.etiquette;
    } else {
      octets = octetsDuTexte(brut).octets;
    }
  } catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Bloc illisible : ') + String(e.message || e) }));
    return box;
  }

  add(box, kv('Bloc', etiquette, { hl: true }));
  add(box, kv('Taille', octets.length + ' octets', { always: true }));

  try {
    const resume = resumerCertificat(octets);
    box.appendChild(sec('Certificat', resume.version));
    add(box, kv('Sujet', resume.sujet, { copy: true, hl: true }));
    add(box, kv('Emetteur', resume.emetteur, { copy: true }));
    add(box, kv('Numero de serie', resume.numeroDeSerie, { copy: true }));
    add(box, kv('Algorithme de signature', resume.algorithmeDeSignature));
    add(box, kv('Algorithme de cle', resume.algorithmeDeCle));
    add(box, kv('Taille de cle', resume.tailleDeCle));
    add(box, kv('Courbe', resume.courbe));
    add(box, kv('Valide a partir de', resume.valideDes));
    add(box, kv('Valide jusqu au', resume.valideJusqua, { hl: true }));
    if (resume.expire) {
      box.appendChild(el('p', { class: 'note warn', text: t('Ce certificat est expire.') }));
    } else if (resume.joursRestants != null) {
      add(box, kv('Jours restants', resume.joursRestants, { always: true }));
    }
    add(box, kv('Autorite de certification', resume.autorite === null ? null : (resume.autorite ? t('oui') : t('non'))));
    if (resume.noms.length) {
      box.appendChild(sec('Noms couverts', resume.noms.length));
      for (const nom of resume.noms) add(box, kv('nom', nom, { copy: true }));
    }
    if (resume.usages.length) {
      box.appendChild(sec('Usages de la cle', resume.usages.length));
      for (const u of resume.usages) add(box, kv('usage', t(u)));
    }
    if (resume.usagesEtendus.length) {
      box.appendChild(sec('Usages etendus', resume.usagesEtendus.length));
      for (const u of resume.usagesEtendus) add(box, kv('usage', t(u)));
    }
    box.appendChild(sec('Extensions', resume.extensions.length));
    for (const ext of resume.extensions) {
      add(box, kv(t(ext.nom), ext.oid + (ext.critique ? '   ·   ' + t('critique') : '')));
    }
  } catch (e) {
    box.appendChild(el('p', { class: 'note', text:
      t('Ce bloc n est pas un certificat : ') + String(e.message || e) }));
  }

  const montrer = etat.arbreDer === true;
  box.appendChild(el('div', { class: 'actions' },
    button(montrer ? 'Masquer la structure ASN.1' : 'Voir la structure ASN.1',
      () => { etat.arbreDer = !montrer; redessiner(); })));
  if (montrer) {
    try { box.appendChild(el('div', { class: 'tree' }, jsonTree(lireDer(octets), 'DER'))); }
    catch (e) { box.appendChild(el('p', { class: 'note warn', text: String(e.message || e) })); }
  }
  return box;
}

/* --------------------------- Jeux de caracteres --------------------------- */
function ecrireCharsets(box, octets, entree, etat, redessiner, poser) {
  box.appendChild(sec('Jeux de caracteres', jeuxDisponibles().length + ' lisibles par ce moteur'));

  const trace = traceDeMojibake(String(entree || ''));
  if (trace.suspect) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Ce texte porte les traces d un UTF-8 relu dans un autre jeu : ') + trace.suites.join(' ') }));
    box.appendChild(el('div', { class: 'actions' },
      button('Reparer le texte', () => {
        const repare = reparerMojibake(String(entree));
        if (repare === String(entree)) return toast('Aucune reparation possible sur ce texte', false);
        poser(repare);
      })));
  }

  const essais = essayerJeux(octets, 12);
  box.appendChild(sec('Lectures possibles', essais.length));
  for (const essai of essais) {
    const carte = el('div', { class: 'find info' }, [
      el('h4', { text: essai.jeu + (essai.remplacements ? '   ·   ' + essai.remplacements + ' ' + t('caracteres perdus') : '') }),
      el('pre', { class: 'pre', text: essai.texte.slice(0, 2000) })
    ]);
    carte.appendChild(el('div', { class: 'actions' },
      button('Reprendre comme entree', () => poser(essai.texte))));
    box.appendChild(carte);
  }

  const jeu = etat.jeuChoisi || 'utf-8';
  const select = el('select');
  for (const disponible of jeuxDisponibles()) {
    select.appendChild(el('option', { value: disponible, text: disponible, selected: disponible === jeu }));
  }
  select.addEventListener('change', () => { etat.jeuChoisi = select.value; redessiner(); });
  const actions = el('div', { class: 'actions' }, [select]);
  actions.appendChild(button('Decoder avec ce jeu', () => {
    try { poser(decoderAvec(octets, jeu)); }
    catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(actions);
  return box;
}
