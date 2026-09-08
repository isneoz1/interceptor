/* Ports et services — INTERCEPTOR (by NeoZ)
 *
 * Les affectations publiees par l IANA, plus les usages devenus des standards
 * de fait (3000, 8080, 5432...) marques comme tels. Sert a lire un port vu
 * dans une URL ou une redirection sans aller chercher ailleurs.
 */

const P = [
  [20, 'tcp', 'FTP donnees', 'Canal de donnees FTP, en clair.'],
  [21, 'tcp', 'FTP', 'Commandes FTP, en clair.'],
  [22, 'tcp', 'SSH', 'Terminal distant chiffre, et transfert SFTP.'],
  [23, 'tcp', 'Telnet', 'Terminal distant en clair. A ne plus employer.'],
  [25, 'tcp', 'SMTP', 'Remise de courrier entre serveurs.'],
  [53, 'tcp/udp', 'DNS', 'Resolution de noms.'],
  [67, 'udp', 'DHCP serveur', 'Attribution d adresses.'],
  [68, 'udp', 'DHCP client', 'Reponse au client.'],
  [69, 'udp', 'TFTP', 'Transfert simple, sans authentification.'],
  [80, 'tcp', 'HTTP', 'Web en clair.'],
  [88, 'tcp/udp', 'Kerberos', 'Authentification de domaine.'],
  [110, 'tcp', 'POP3', 'Releve de courrier, en clair.'],
  [111, 'tcp/udp', 'RPCbind', 'Annuaire d appels de procedure distante.'],
  [119, 'tcp', 'NNTP', 'Groupes de discussion Usenet.'],
  [123, 'udp', 'NTP', 'Synchronisation d horloge.'],
  [135, 'tcp', 'MSRPC', 'Appel de procedure distante Microsoft.'],
  [137, 'udp', 'NetBIOS noms', 'Resolution de noms Windows historique.'],
  [139, 'tcp', 'NetBIOS session', 'Partage Windows historique.'],
  [143, 'tcp', 'IMAP', 'Consultation de courrier, en clair.'],
  [161, 'udp', 'SNMP', 'Supervision d equipement.'],
  [162, 'udp', 'SNMP trap', 'Alertes emises par un equipement.'],
  [179, 'tcp', 'BGP', 'Routage entre operateurs.'],
  [194, 'tcp', 'IRC', 'Discussion en direct.'],
  [389, 'tcp', 'LDAP', 'Annuaire, en clair.'],
  [443, 'tcp', 'HTTPS', 'Web chiffre par TLS. Aussi QUIC et HTTP/3 en UDP.'],
  [445, 'tcp', 'SMB', 'Partage de fichiers Windows.'],
  [465, 'tcp', 'SMTPS', 'Envoi de courrier chiffre des la connexion.'],
  [500, 'udp', 'IKE', 'Negociation IPsec.'],
  [514, 'udp', 'Syslog', 'Journalisation distante.'],
  [515, 'tcp', 'LPD', 'Impression reseau historique.'],
  [520, 'udp', 'RIP', 'Routage interne ancien.'],
  [546, 'udp', 'DHCPv6 client', 'Attribution d adresses IPv6.'],
  [547, 'udp', 'DHCPv6 serveur', 'Attribution d adresses IPv6.'],
  [554, 'tcp', 'RTSP', 'Controle de flux video.'],
  [587, 'tcp', 'SMTP soumission', 'Envoi de courrier authentifie, avec STARTTLS.'],
  [631, 'tcp', 'IPP', 'Impression moderne, CUPS.'],
  [636, 'tcp', 'LDAPS', 'Annuaire chiffre.'],
  [873, 'tcp', 'rsync', 'Synchronisation de fichiers.'],
  [989, 'tcp', 'FTPS donnees', 'FTP chiffre, canal de donnees.'],
  [990, 'tcp', 'FTPS', 'FTP chiffre, canal de commandes.'],
  [993, 'tcp', 'IMAPS', 'Courrier chiffre.'],
  [995, 'tcp', 'POP3S', 'Courrier chiffre.'],
  [1080, 'tcp', 'SOCKS', 'Mandataire generique.'],
  [1194, 'udp', 'OpenVPN', 'Reseau prive virtuel.'],
  [1433, 'tcp', 'SQL Server', 'Base de donnees Microsoft.'],
  [1521, 'tcp', 'Oracle', 'Base de donnees Oracle.'],
  [1701, 'udp', 'L2TP', 'Tunnel de niveau 2.'],
  [1723, 'tcp', 'PPTP', 'VPN ancien, casse.'],
  [1883, 'tcp', 'MQTT', 'Messagerie objets connectes, en clair.'],
  [2049, 'tcp', 'NFS', 'Partage de fichiers Unix.'],
  [2375, 'tcp', 'Docker', 'API Docker en clair. Jamais exposee.'],
  [2376, 'tcp', 'Docker TLS', 'API Docker chiffree.'],
  [3000, 'tcp', 'Serveur de developpement', 'Usage de fait : Node, Next.js, Grafana.'],
  [3128, 'tcp', 'Squid', 'Mandataire web.'],
  [3306, 'tcp', 'MySQL', 'Base de donnees MySQL ou MariaDB.'],
  [3389, 'tcp', 'RDP', 'Bureau a distance Windows.'],
  [4444, 'tcp', 'Divers', 'Aucune affectation stable : outils de test et de developpement.'],
  [4840, 'tcp', 'OPC UA', 'Automatisme industriel.'],
  [5000, 'tcp', 'Serveur de developpement', 'Usage de fait : Flask, ASP.NET, AirPlay sur macOS.'],
  [5060, 'tcp/udp', 'SIP', 'Signalisation telephonie, en clair.'],
  [5061, 'tcp', 'SIP TLS', 'Signalisation telephonie chiffree.'],
  [5173, 'tcp', 'Vite', 'Usage de fait : serveur de developpement Vite.'],
  [5222, 'tcp', 'XMPP client', 'Messagerie instantanee.'],
  [5432, 'tcp', 'PostgreSQL', 'Base de donnees PostgreSQL.'],
  [5601, 'tcp', 'Kibana', 'Interface Elastic.'],
  [5672, 'tcp', 'AMQP', 'File de messages RabbitMQ.'],
  [5900, 'tcp', 'VNC', 'Bureau a distance.'],
  [6379, 'tcp', 'Redis', 'Cache et base cle-valeur.'],
  [6443, 'tcp', 'Kubernetes', 'Serveur d API du cluster.'],
  [6667, 'tcp', 'IRC', 'Discussion en direct.'],
  [8000, 'tcp', 'Serveur de developpement', 'Usage de fait : Django, http.server.'],
  [8080, 'tcp', 'HTTP alternatif', 'Usage de fait : Tomcat, mandataires, applications.'],
  [8086, 'tcp', 'InfluxDB', 'Base de series temporelles.'],
  [8443, 'tcp', 'HTTPS alternatif', 'Usage de fait : consoles d administration.'],
  [8883, 'tcp', 'MQTT TLS', 'Messagerie objets connectes chiffree.'],
  [9000, 'tcp', 'Divers', 'Usage de fait : PHP-FPM, MinIO, SonarQube.'],
  [9090, 'tcp', 'Prometheus', 'Collecte de metriques.'],
  [9092, 'tcp', 'Kafka', 'Journal de messages distribue.'],
  [9200, 'tcp', 'Elasticsearch', 'Moteur de recherche, API REST.'],
  [11211, 'tcp', 'Memcached', 'Cache memoire.'],
  [15672, 'tcp', 'RabbitMQ', 'Interface d administration.'],
  [27017, 'tcp', 'MongoDB', 'Base de documents.'],
  [50000, 'tcp', 'Divers', 'Usage de fait : DB2, Jenkins, SAP.']
];

export const PORTS = P.map(([numero, protocole, service, note]) => ({ numero, protocole, service, note }));

const INDEX = new Map(PORTS.map(p => [p.numero, p]));

/** Service connu pour un port, ou null. */
export function decrirePort(numero) {
  return INDEX.get(Number(numero)) || null;
}

/** Recherche libre par numero, service ou note. */
export function chercherPorts(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return PORTS;
  return PORTS.filter(p =>
    String(p.numero).includes(q) ||
    p.service.toLowerCase().includes(q) ||
    p.note.toLowerCase().includes(q));
}

/** Plage d appartenance d un port, telle que le RFC 6335 la definit. */
export function plagePort(numero) {
  const n = Number(numero);
  if (!Number.isInteger(n) || n < 0 || n > 65535) return 'hors plage';
  if (n === 0) return 'reserve';
  if (n < 1024) return 'port systeme (1 a 1023)';
  if (n < 49152) return 'port enregistre (1024 a 49151)';
  return 'port dynamique ou prive (49152 a 65535)';
}
