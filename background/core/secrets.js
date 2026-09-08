/* Catalogues de detection — INTERCEPTOR (by NeoZ)
 *
 * Trois catalogues purs, sans dependance : secrets, donnees personnelles,
 * pisteurs. Ils sont lus par core/analyzer.js, qui applique les reglages
 * (familles activables, motifs personnels, masquage).
 *
 * Forme d une entree : [ expression globale, etiquette, severite ]
 * La severite suit l echelle du projet : critical, high, medium, low, info.
 *
 * Un motif ne doit jamais etre approximatif au point de crier sur du trafic
 * ordinaire : chaque expression porte le prefixe reel du fournisseur.
 */

/* ------------------------------------------------------------------ */
/* 1. Secrets et jetons                                                */
/* ------------------------------------------------------------------ */
export const SECRET_PATTERNS = [
  /* --- Amazon Web Services --- */
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS Access Key ID', 'critical'],
  [/\bASIA[0-9A-Z]{16}\b/g, 'AWS STS Key ID', 'critical'],
  [/\bABIA[0-9A-Z]{16}\b/g, 'AWS Bearer Token', 'critical'],
  [/\baws_secret_access_key["'\s:=]+([A-Za-z0-9/+=]{40})/gi, 'AWS Secret Key', 'critical'],
  [/\bamzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, 'Amazon MWS Token', 'critical'],

  /* --- Google et Firebase --- */
  [/\bAIza[0-9A-Za-z\-_]{35}\b/g, 'Google API Key', 'high'],
  [/\bya29\.[0-9A-Za-z\-_]+/g, 'Google OAuth Token', 'critical'],
  [/\bGOCSPX-[0-9A-Za-z\-_]{28}\b/g, 'Google OAuth Client Secret', 'critical'],

  /* --- Microsoft, Azure --- */
  [/\bAccountKey=[A-Za-z0-9+/=]{60,}/g, 'Azure Storage Account Key', 'critical'],
  [/\bSharedAccessSignature\s*=\s*[^\s"';]+/gi, 'Azure Shared Access Signature', 'critical'],

  /* --- Plateformes de code --- */
  [/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, 'GitHub Token', 'critical'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, 'GitHub Fine-grained Token', 'critical'],
  [/\bglpat-[A-Za-z0-9\-_]{20,}\b/g, 'GitLab Token', 'critical'],
  [/\bglptt-[A-Za-z0-9\-_]{20,}\b/g, 'GitLab Trigger Token', 'high'],
  [/\bATATT3[A-Za-z0-9\-_=]{20,}\b/g, 'Atlassian API Token', 'critical'],

  /* --- Paiement --- */
  [/\bsk_live_[0-9a-zA-Z]{16,}\b/g, 'Stripe Secret Key', 'critical'],
  [/\brk_live_[0-9a-zA-Z]{16,}\b/g, 'Stripe Restricted Key', 'high'],
  [/\bsq0(atp|csp)-[A-Za-z0-9\-_]{20,}\b/g, 'Square Token', 'critical'],
  [/\bEAAA[A-Za-z0-9\-_]{60,}\b/g, 'Square Access Token', 'critical'],
  [/\baccess_token\$production\$[a-z0-9]{16}\$[a-f0-9]{32}\b/g, 'Braintree Token', 'critical'],
  [/\bshpat_[a-fA-F0-9]{32}\b/g, 'Shopify Access Token', 'critical'],
  [/\bshpss_[a-fA-F0-9]{32}\b/g, 'Shopify Shared Secret', 'critical'],
  [/\bshpca_[a-fA-F0-9]{32}\b/g, 'Shopify Custom App Token', 'critical'],

  /* --- Messagerie et communication --- */
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, 'Slack Token', 'critical'],
  [/\bhooks\.slack\.com\/services\/T[A-Za-z0-9_]+\/B[A-Za-z0-9_]+\/[A-Za-z0-9_]+/g, 'Slack Webhook', 'high'],
  [/\bdiscord(?:app)?\.com\/api\/webhooks\/[0-9]{17,20}\/[A-Za-z0-9_\-]{60,}/g, 'Discord Webhook', 'high'],
  [/\b[MNO][A-Za-z0-9_\-]{23,25}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27,}\b/g, 'Discord Bot Token', 'critical'],
  [/\b[0-9]{8,10}:AA[A-Za-z0-9_\-]{33}\b/g, 'Telegram Bot Token', 'critical'],
  [/\bSG\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}\b/g, 'SendGrid Key', 'critical'],
  [/\bkey-[0-9a-f]{32}\b/g, 'Mailgun Key', 'critical'],
  [/\bSK[0-9a-fA-F]{32}\b/g, 'Twilio API Key', 'critical'],
  [/\bxkeysib-[0-9a-f]{64}-[A-Za-z0-9]{16}\b/g, 'Brevo (Sendinblue) Key', 'critical'],

  /* --- Intelligence artificielle --- */
  [/\bsk-ant-(?:api|admin)[A-Za-z0-9\-_]{20,}\b/g, 'Anthropic API Key', 'critical'],
  [/\bsk-proj-[A-Za-z0-9\-_]{20,}\b/g, 'OpenAI Project Key', 'critical'],
  [/\bsk-[A-Za-z0-9]{48}\b/g, 'OpenAI API Key', 'critical'],
  [/\bhf_[A-Za-z0-9]{34,}\b/g, 'Hugging Face Token', 'critical'],
  [/\br8_[A-Za-z0-9]{37,}\b/g, 'Replicate Token', 'critical'],
  [/\bgsk_[A-Za-z0-9]{40,}\b/g, 'Groq API Key', 'critical'],

  /* --- Hebergement et infrastructure --- */
  [/\bdop_v1_[a-f0-9]{64}\b/g, 'DigitalOcean Token', 'critical'],
  [/\bdoo_v1_[a-f0-9]{64}\b/g, 'DigitalOcean OAuth Token', 'critical'],
  [/\bHRKU-[A-Za-z0-9_\-]{20,}\b/g, 'Heroku API Key', 'critical'],
  [/\bnfp_[A-Za-z0-9]{20,}\b/g, 'Netlify Token', 'critical'],
  [/\brnd_[A-Za-z0-9]{20,}\b/g, 'Render API Key', 'critical'],
  [/\bcfpat-[A-Za-z0-9\-_]{40,}\b/g, 'Contentful Token', 'high'],
  [/\bdckr_pat_[A-Za-z0-9\-_]{20,}\b/g, 'Docker Hub Token', 'critical'],
  [/\bnpm_[A-Za-z0-9]{36}\b/g, 'npm Token', 'critical'],
  [/\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,}\b/g, 'PyPI Token', 'critical'],
  [/\bcio[A-Za-z0-9]{40,}\b/g, 'Crates.io Token', 'critical'],

  /* --- Supervision et outils --- */
  [/\bSENTRY_AUTH_TOKEN["'\s:=]+([A-Za-z0-9]{32,})/gi, 'Sentry Auth Token', 'critical'],
  [/\bsntrys_[A-Za-z0-9\-_.]{40,}\b/g, 'Sentry Token', 'critical'],
  [/\bNRAK-[A-Z0-9]{27}\b/g, 'New Relic Key', 'critical'],
  [/\bdd[a-z]{0,3}_[A-Za-z0-9]{30,}\b/g, 'Datadog API Key', 'critical'],
  [/\bsecret_[A-Za-z0-9]{43}\b/g, 'Notion Integration Token', 'critical'],
  [/\blin_api_[A-Za-z0-9]{40,}\b/g, 'Linear API Key', 'critical'],
  [/\bfigd_[A-Za-z0-9\-_]{40,}\b/g, 'Figma Token', 'critical'],
  [/\bsl\.[A-Za-z0-9\-_]{130,}\b/g, 'Dropbox Token', 'critical'],
  [/\bEAACEdEose0cBA[A-Za-z0-9]+\b/g, 'Facebook Access Token', 'critical'],

  /* --- Bases de donnees et files : chaines de connexion completes --- */
  [/\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|rediss):\/\/[^\s:@/"']+:[^\s:@/"']+@[^\s"'<>]+/gi,
    'Chaine de connexion avec mot de passe', 'critical'],
  [/\bhttps?:\/\/[^\s:@/"']+:[^\s:@/"']+@[^\s"'<>]+/gi, 'Identifiants dans une URL', 'critical'],

  /* --- Cles privees et certificats --- */
  [/-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, 'Cle privee', 'critical'],
  [/\bputty-user-key-file-\d\b/gi, 'Cle privee PuTTY', 'critical'],

];

/* ------------------------------------------------------------------ */
/* 2. Pisteurs, regies publicitaires et telemetrie                     */
/* ------------------------------------------------------------------ */
export const TRACKERS = [
  /* Mesure d audience */
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com', 'region1.analytics.google.com',
  'matomo.cloud', 'quantserve.com', 'scorecardresearch.com', 'chartbeat.com', 'parsely.com',
  'plausible.io', 'simpleanalytics.com', 'statcounter.com', 'histats.com', 'kissmetrics.com',
  /* Regies publicitaires */
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adservice.google.com',
  'criteo.com', 'criteo.net', 'taboola.com', 'outbrain.com', 'adnxs.com', 'rubiconproject.com',
  'pubmatic.com', 'openx.net', 'casalemedia.com', 'sharethrough.com', 'bidswitch.net',
  'smartadserver.com', 'teads.tv', 'indexexchange.com', 'triplelift.com', 'yieldmo.com',
  'amazon-adsystem.com', 'media.net', 'adform.net', 'zemanta.com', 'sovrn.com',
  /* Reseaux sociaux */
  'facebook.net', 'connect.facebook.net', 'facebook.com/tr', 'ads.linkedin.com',
  'analytics.tiktok.com', 'tiktok.com/i18n', 'snapchat.com/tr', 'pinterest.com/ct',
  'reddit.com/pixel', 'ads.twitter.com', 'analytics.twitter.com', 't.co/i/adsct',
  /* Produit et comportement */
  'hotjar.com', 'mixpanel.com', 'segment.io', 'segment.com', 'amplitude.com',
  'fullstory.com', 'clarity.ms', 'logrocket.com', 'smartlook.com', 'mouseflow.com',
  'heap.io', 'heapanalytics.com', 'posthog.com', 'pendo.io', 'inspectlet.com',
  'crazyegg.com', 'luckyorange.com', 'contentsquare.net', 'quantummetric.com',
  /* Attribution mobile et notifications */
  'branch.io', 'appsflyer.com', 'adjust.com', 'onesignal.com', 'airship.com',
  'kochava.com', 'singular.net', 'tenjin.io', 'batch.com',
  /* Support et engagement */
  'intercom.io', 'drift.com', 'zendesk.com/embeddable', 'hubspot.com/__ptq.gif',
  'klaviyo.com', 'mailchimp.com/mcjs', 'braze.com', 'iterable.com',
  /* Supervision applicative */
  'bugsnag.com', 'sentry.io', 'newrelic.com', 'nr-data.net', 'datadoghq.com',
  'rollbar.com', 'raygun.io', 'trackjs.com', 'dynatrace.com', 'appdynamics.com',
  /* Regies moteurs de recherche */
  'bat.bing.com', 'yandex.ru/metrika', 'mc.yandex.ru', 'clarity.microsoft.com',
  'ads.yahoo.com', 'analytics.yahoo.com', 'baidu.com/hm.js'
];
