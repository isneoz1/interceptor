/* Capture TLS / chaine de certificats — INTERCEPTOR (by NeoZ)
 * getSecurityInfo() n'est exploitable que depuis un listener onHeadersReceived bloquant.
 */
import { B } from '../lib/util.js';
import { store } from '../core/store.js';

const seenHosts = new Map();   // host -> resume TLS (evite de re-interroger a chaque requete)

export const securityStats = { queried: 0, cached: 0, failed: 0 };

export async function captureSecurity(rec, details) {
  try {
    const cached = seenHosts.get(rec.host);
    const needsFull = rec.type === 'main_frame' || rec.type === 'sub_frame' || !cached;

    if (!needsFull && cached) {
      rec.security = { ...cached, fromCache: true };
      securityStats.cached++;
      store.touch(rec.id);
      return;
    }

    const info = await B.webRequest.getSecurityInfo(details.requestId, {
      certificateChain: true,
      rawDER: false
    });
    securityStats.queried++;
    if (!info) return;

    const sec = {
      state: info.state || 'unknown',
      protocolVersion: info.protocolVersion || null,
      cipherSuite: info.cipherSuite || null,
      keaGroupName: info.keaGroupName || null,
      signatureSchemeName: info.signatureSchemeName || null,
      secretKeyLength: info.secretKeyLength || null,
      isDomainMismatch: !!info.isDomainMismatch,
      isExtendedValidation: !!info.isExtendedValidation,
      isNotValidAtThisTime: !!info.isNotValidAtThisTime,
      isUntrusted: !!info.isUntrusted,
      certificateTransparencyStatus: info.certificateTransparencyStatus || null,
      hsts: !!info.hsts,
      hpkp: !!info.hpkp,
      usedDelegatedCredentials: !!info.usedDelegatedCredentials,
      usedEch: !!info.usedEch,
      usedOcsp: !!info.usedOcsp,
      usedPrivateDns: !!info.usedPrivateDns,
      certificates: (info.certificates || []).map(c => ({
        subject: c.subject,
        issuer: c.issuer,
        serialNumber: c.serialNumber,
        fingerprintSha1: c.fingerprint ? c.fingerprint.sha1 : null,
        fingerprintSha256: c.fingerprint ? c.fingerprint.sha256 : null,
        validityStart: c.validity ? c.validity.start : null,
        validityEnd: c.validity ? c.validity.end : null,
        subjectPublicKeyInfoDigest: c.subjectPublicKeyInfoDigest
          ? c.subjectPublicKeyInfoDigest.sha256 : null,
        isBuiltInRoot: !!c.isBuiltInRoot
      })),
      fromCache: false
    };

    rec.security = sec;
    if (rec.host) {
      const { certificates, ...light } = sec;
      seenHosts.set(rec.host, { ...light, certificates: certificates.slice(0, 1) });
    }
    store.mark(rec, 'tls:info', Date.now(), { state: sec.state, version: sec.protocolVersion });
    store.addSource(rec, 'tls');
    store.touch(rec.id);
  } catch (e) {
    securityStats.failed++;
  }
}

export function clearSecurityCache() { seenHosts.clear(); }
