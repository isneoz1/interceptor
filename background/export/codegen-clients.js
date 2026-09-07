/* Generateurs de code par langage — INTERCEPTOR (by D4RK)
 *
 * Un client HTTP pour chaque grand langage du monde. Chaque fonction recoit un
 * enregistrement capture et rend un extrait pret a coller. Aucune sortie
 * reseau : ce module ne fait que produire du texte.
 *
 * Les generateurs bruts (curl, wget, fetch, HTTP brut...) vivent dans
 * codegen.js ; ici vivent les langages : Ruby, PHP, Go, Rust, Java, Kotlin,
 * C#, Swift, Dart, Elixir, R, Perl, Clojure, Objective-C, et les clients
 * JavaScript alternatifs (axios, jQuery, XHR), httpx, k6, Ansible.
 */
import {
  NL, target, usableHeaders, bodyText, contentType, dq, sq, yq, jsQuote, headerMap
} from './codegen-util.js';

const cap = m => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
const lower = m => String(m || 'GET').toLowerCase();

/* ------------------------------- Ruby ------------------------------------- */
export function toRuby(rec) {
  const url = target(rec);
  const lines = [
    "require 'net/http'", "require 'uri'", '',
    'uri = URI(' + sq(url) + ')',
    'http = Net::HTTP.new(uri.host, uri.port)',
    "http.use_ssl = uri.scheme == 'https'",
    'req = Net::HTTP::' + cap(rec.method) + '.new(uri)'
  ];
  for (const h of usableHeaders(rec)) lines.push('req[' + sq(h.name) + '] = ' + sq(h.value));
  const body = bodyText(rec);
  if (body) lines.push('req.body = ' + sq(body));
  lines.push('res = http.request(req)', 'puts res.code', 'puts res.body');
  return lines.join(NL);
}

export function toHttParty(rec) {
  const lines = ["require 'httparty'", ''];
  const opts = [];
  const heads = usableHeaders(rec);
  if (heads.length) {
    opts.push('  headers: {');
    heads.forEach((h, i) => opts.push('    ' + sq(h.name) + ' => ' + sq(h.value) + (i < heads.length - 1 ? ',' : '')));
    opts.push('  }' + (bodyText(rec) ? ',' : ''));
  }
  const body = bodyText(rec);
  if (body) opts.push('  body: ' + sq(body));
  lines.push('res = HTTParty.' + lower(rec.method) + '(' + sq(target(rec)) + (opts.length ? ',' : '') + NL +
    opts.join(NL) + NL + ')');
  lines.push('puts res.code', 'puts res.body');
  return lines.join(NL);
}

/* -------------------------------- PHP ------------------------------------- */
export function toPhp(rec) {
  const lines = ['<?php', '$ch = curl_init();',
    'curl_setopt($ch, CURLOPT_URL, ' + sq(target(rec)) + ');',
    'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);',
    'curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ' + sq(rec.method) + ');'];
  const heads = usableHeaders(rec);
  if (heads.length) {
    lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [');
    for (const h of heads) lines.push('  ' + sq(h.name + ': ' + h.value) + ',');
    lines.push(']);');
  }
  const body = bodyText(rec);
  if (body) lines.push('curl_setopt($ch, CURLOPT_POSTFIELDS, ' + sq(body) + ');');
  lines.push('$response = curl_exec($ch);', 'curl_close($ch);', 'echo $response;');
  return lines.join(NL);
}

export function toGuzzle(rec) {
  const lines = ['<?php', "require 'vendor/autoload.php';", 'use GuzzleHttp\\Client;', '',
    '$client = new Client();',
    '$response = $client->request(' + sq(rec.method) + ', ' + sq(target(rec)) + ', ['];
  const heads = usableHeaders(rec);
  if (heads.length) {
    lines.push("    'headers' => [");
    for (const h of heads) lines.push('        ' + sq(h.name) + ' => ' + sq(h.value) + ',');
    lines.push('    ],');
  }
  const body = bodyText(rec);
  if (body) lines.push("    'body' => " + sq(body) + ',');
  lines.push(']);', 'echo $response->getBody();');
  return lines.join(NL);
}

/* -------------------------------- Go -------------------------------------- */
export function toGo(rec) {
  const body = bodyText(rec);
  const imports = ['"fmt"', '"io"', '"net/http"'];
  if (body) imports.push('"strings"');
  const lines = ['package main', '', 'import (',
    ...imports.map(i => '\t' + i), ')', '', 'func main() {'];
  if (body) lines.push('\tbody := strings.NewReader(' + dq(body) + ')');
  lines.push('\treq, _ := http.NewRequest(' + dq(rec.method) + ', ' + dq(target(rec)) + ', ' + (body ? 'body' : 'nil') + ')');
  for (const h of usableHeaders(rec)) lines.push('\treq.Header.Set(' + dq(h.name) + ', ' + dq(h.value) + ')');
  lines.push('\tresp, err := http.DefaultClient.Do(req)', '\tif err != nil {', '\t\tpanic(err)', '\t}',
    '\tdefer resp.Body.Close()', '\tdata, _ := io.ReadAll(resp.Body)',
    '\tfmt.Println(resp.Status)', '\tfmt.Println(string(data))', '}');
  return lines.join(NL);
}

/* -------------------------------- Rust ------------------------------------ */
export function toRust(rec) {
  const lines = ['use reqwest::blocking::Client;', '',
    'fn main() -> Result<(), Box<dyn std::error::Error>> {',
    '    let client = Client::new();',
    '    let res = client',
    '        .request(reqwest::Method::from_bytes(b' + dq(rec.method) + ')?, ' + dq(target(rec)) + ')'];
  for (const h of usableHeaders(rec)) lines.push('        .header(' + dq(h.name) + ', ' + dq(h.value) + ')');
  const body = bodyText(rec);
  if (body) lines.push('        .body(' + dq(body) + ')');
  lines.push('        .send()?;', '    println!("{}", res.status());',
    '    println!("{}", res.text()?);', '    Ok(())', '}');
  return lines.join(NL);
}

/* --------------------------- Java / Kotlin -------------------------------- */
export function toJava(rec) {
  const body = bodyText(rec);
  const pub = body ? 'HttpRequest.BodyPublishers.ofString(' + dq(body) + ')' : 'HttpRequest.BodyPublishers.noBody()';
  const lines = ['import java.net.URI;', 'import java.net.http.*;', '',
    'HttpClient client = HttpClient.newHttpClient();',
    'HttpRequest request = HttpRequest.newBuilder()',
    '    .uri(URI.create(' + dq(target(rec)) + '))',
    '    .method(' + dq(rec.method) + ', ' + pub + ')'];
  for (const h of usableHeaders(rec)) lines.push('    .header(' + dq(h.name) + ', ' + dq(h.value) + ')');
  lines.push('    .build();',
    'HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());',
    'System.out.println(response.statusCode());', 'System.out.println(response.body());');
  return lines.join(NL);
}

export function toOkHttp(rec) {
  const body = bodyText(rec);
  const lines = ['import okhttp3.*;', '', 'OkHttpClient client = new OkHttpClient();'];
  if (body) {
    lines.push('MediaType mediaType = MediaType.parse(' + dq(contentType(rec)) + ');',
      'RequestBody body = RequestBody.create(' + dq(body) + ', mediaType);');
  }
  lines.push('Request request = new Request.Builder()', '    .url(' + dq(target(rec)) + ')',
    '    .method(' + dq(rec.method) + ', ' + (body ? 'body' : 'null') + ')');
  for (const h of usableHeaders(rec)) lines.push('    .addHeader(' + dq(h.name) + ', ' + dq(h.value) + ')');
  lines.push('    .build();', 'Response response = client.newCall(request).execute();',
    'System.out.println(response.code());', 'System.out.println(response.body().string());');
  return lines.join(NL);
}

export function toKotlin(rec) {
  const body = bodyText(rec);
  const lines = ['import okhttp3.*', 'import okhttp3.MediaType.Companion.toMediaType',
    'import okhttp3.RequestBody.Companion.toRequestBody', '', 'val client = OkHttpClient()'];
  if (body) lines.push('val body = ' + dq(body) + '.toRequestBody(' + dq(contentType(rec)) + '.toMediaType())');
  lines.push('val request = Request.Builder()', '    .url(' + dq(target(rec)) + ')',
    '    .method(' + dq(rec.method) + ', ' + (body ? 'body' : 'null') + ')');
  for (const h of usableHeaders(rec)) lines.push('    .addHeader(' + dq(h.name) + ', ' + dq(h.value) + ')');
  lines.push('    .build()', 'client.newCall(request).execute().use { response ->',
    '    println(response.code)', '    println(response.body?.string())', '}');
  return lines.join(NL);
}

/* -------------------------------- C# -------------------------------------- */
export function toCSharp(rec) {
  const body = bodyText(rec);
  const lines = ['using System;', 'using System.Net.Http;', 'using System.Text;',
    'using System.Threading.Tasks;', '', 'using var client = new HttpClient();',
    'var request = new HttpRequestMessage(new HttpMethod(' + dq(rec.method) + '), ' + dq(target(rec)) + ');'];
  for (const h of usableHeaders(rec)) {
    if (String(h.name).toLowerCase() === 'content-type') continue;
    lines.push('request.Headers.TryAddWithoutValidation(' + dq(h.name) + ', ' + dq(h.value) + ');');
  }
  if (body) lines.push('request.Content = new StringContent(' + dq(body) + ', Encoding.UTF8, ' + dq((contentType(rec) || '').split(';')[0]) + ');');
  lines.push('var response = await client.SendAsync(request);',
    'Console.WriteLine((int)response.StatusCode);',
    'Console.WriteLine(await response.Content.ReadAsStringAsync());');
  return lines.join(NL);
}

export function toRestSharp(rec) {
  const lines = ['using RestSharp;', '', 'var client = new RestClient(' + dq(target(rec)) + ');',
    'var request = new RestRequest("", Method.' + cap(rec.method) + ');'];
  for (const h of usableHeaders(rec)) lines.push('request.AddHeader(' + dq(h.name) + ', ' + dq(h.value) + ');');
  const body = bodyText(rec);
  if (body) lines.push('request.AddStringBody(' + dq(body) + ', DataFormat.Json);');
  lines.push('var response = client.Execute(request);', 'Console.WriteLine(response.StatusCode);',
    'Console.WriteLine(response.Content);');
  return lines.join(NL);
}

/* -------------------------------- Swift ----------------------------------- */
export function toSwift(rec) {
  const lines = ['import Foundation', '',
    'var request = URLRequest(url: URL(string: ' + dq(target(rec)) + ')!)',
    'request.httpMethod = ' + dq(rec.method)];
  for (const h of usableHeaders(rec)) lines.push('request.addValue(' + dq(h.value) + ', forHTTPHeaderField: ' + dq(h.name) + ')');
  const body = bodyText(rec);
  if (body) lines.push('request.httpBody = ' + dq(body) + '.data(using: .utf8)');
  lines.push('', 'let task = URLSession.shared.dataTask(with: request) { data, response, error in',
    '    if let data = data { print(String(data: data, encoding: .utf8) ?? "") }', '}', 'task.resume()');
  return lines.join(NL);
}

/* -------------------------------- Dart ------------------------------------ */
export function toDart(rec) {
  const heads = usableHeaders(rec);
  const body = bodyText(rec);
  const lines = ["import 'package:http/http.dart' as http;", '', 'void main() async {',
    '  final response = await http.' + lower(rec.method) + '('];
  const args = ['    Uri.parse(' + dq(target(rec)) + ')'];
  if (heads.length) {
    let block = '    headers: {' + NL;
    block += heads.map(h => '      ' + dq(h.name) + ': ' + dq(h.value) + ',').join(NL);
    block += NL + '    }';
    args.push(block);
  }
  if (body) args.push('    body: ' + dq(body));
  lines.push(args.join(',' + NL), '  );', '  print(response.statusCode);', '  print(response.body);', '}');
  return lines.join(NL);
}

/* -------------------------------- Elixir ---------------------------------- */
export function toElixir(rec) {
  const heads = usableHeaders(rec).map(h => '{' + dq(h.name) + ', ' + dq(h.value) + '}').join(', ');
  const lines = ['Req.request!(', '  method: :' + lower(rec.method) + ',', '  url: ' + dq(target(rec)) + ','];
  if (heads) lines.push('  headers: [' + heads + '],');
  const body = bodyText(rec);
  if (body) lines.push('  body: ' + dq(body) + ',');
  lines.push(')');
  return lines.join(NL);
}

/* -------------------------------- R --------------------------------------- */
export function toR(rec) {
  const lines = ['library(httr)', '', 'response <- VERB(' + dq(rec.method) + ', ' + dq(target(rec)) + ','];
  const heads = usableHeaders(rec);
  if (heads.length) {
    lines.push('  add_headers(' + heads.map(h => dq(h.name) + ' = ' + dq(h.value)).join(', ') + '),');
  }
  const body = bodyText(rec);
  if (body) lines.push('  body = ' + dq(body) + ',');
  lines.push('  encode = "raw")', 'cat(content(response, "text"))');
  return lines.join(NL);
}

/* -------------------------------- Perl ------------------------------------ */
export function toPerl(rec) {
  const lines = ['use LWP::UserAgent;', 'use HTTP::Request;', '', 'my $ua = LWP::UserAgent->new;',
    'my $req = HTTP::Request->new(' + dq(rec.method) + ', ' + dq(target(rec)) + ');'];
  for (const h of usableHeaders(rec)) lines.push('$req->header(' + dq(h.name) + ' => ' + dq(h.value) + ');');
  const body = bodyText(rec);
  if (body) lines.push('$req->content(' + sq(body) + ');');
  lines.push('my $res = $ua->request($req);', 'print $res->code, "\\n";', 'print $res->decoded_content;');
  return lines.join(NL);
}

/* -------------------------------- Clojure --------------------------------- */
export function toClojure(rec) {
  const lines = ["(require '[clj-http.client :as client])", '',
    '(client/' + lower(rec.method) + ' ' + dq(target(rec))];
  const heads = usableHeaders(rec);
  const opts = [];
  if (heads.length) opts.push('  :headers {' + heads.map(h => dq(h.name) + ' ' + dq(h.value)).join(' ') + '}');
  const body = bodyText(rec);
  if (body) opts.push('  :body ' + dq(body));
  if (opts.length) lines.push('  {' + NL + opts.join(NL) + '})');
  else lines[lines.length - 1] += ')';
  return lines.join(NL);
}

/* ---------------------------- Objective-C --------------------------------- */
export function toObjC(rec) {
  const lines = ['#import <Foundation/Foundation.h>', '',
    'NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:[NSURL URLWithString:@' + dq(target(rec)) + ']];',
    '[request setHTTPMethod:@' + dq(rec.method) + '];'];
  for (const h of usableHeaders(rec)) lines.push('[request addValue:@' + dq(h.value) + ' forHTTPHeaderField:@' + dq(h.name) + '];');
  const body = bodyText(rec);
  if (body) lines.push('[request setHTTPBody:[@' + dq(body) + ' dataUsingEncoding:NSUTF8StringEncoding]];');
  lines.push('', 'NSURLSessionDataTask *task = [[NSURLSession sharedSession] dataTaskWithRequest:request',
    '    completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {',
    '        NSLog(@"%@", [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding]);',
    '    }];', '[task resume];');
  return lines.join(NL);
}

/* --------------------------- JavaScript alternatifs ----------------------- */
export function toAxios(rec) {
  const init = { method: rec.method, url: target(rec), headers: headerMap(rec) };
  const body = bodyText(rec);
  if (body) init.data = body;
  return "import axios from 'axios';" + NL + NL +
    'const response = await axios(' + JSON.stringify(init, null, 2) + ');' + NL +
    'console.log(response.status);' + NL + 'console.log(response.data);';
}

export function toJquery(rec) {
  const settings = { url: target(rec), method: rec.method, headers: headerMap(rec) };
  const body = bodyText(rec);
  if (body) settings.data = body;
  return '$.ajax(' + JSON.stringify(settings, null, 2) + ')' + NL +
    '  .done(function (response) { console.log(response); });';
}

export function toXhr(rec) {
  const lines = ['const xhr = new XMLHttpRequest();',
    'xhr.open(' + jsQuote(rec.method) + ', ' + jsQuote(target(rec)) + ');'];
  for (const h of usableHeaders(rec)) lines.push('xhr.setRequestHeader(' + jsQuote(h.name) + ', ' + jsQuote(h.value) + ');');
  lines.push('xhr.onload = () => console.log(xhr.status, xhr.responseText);');
  const body = bodyText(rec);
  lines.push('xhr.send(' + (body ? jsQuote(body) : '') + ');');
  return lines.join(NL);
}

/* -------------------------------- httpx ----------------------------------- */
export function toHttpx(rec) {
  const lines = ['import httpx', '', 'headers = ' + JSON.stringify(headerMap(rec), null, 4)];
  const body = bodyText(rec);
  const args = [jsQuote(rec.method), jsQuote(target(rec)), 'headers=headers'];
  if (body) { lines.push('content = ' + JSON.stringify(body)); args.push('content=content'); }
  lines.push('response = httpx.request(' + args.join(', ') + ')', 'print(response.status_code)', 'print(response.text)');
  return lines.join(NL);
}

/* --------------------------------- k6 ------------------------------------- */
export function toK6(rec) {
  const body = bodyText(rec);
  const params = { headers: headerMap(rec) };
  const method = lower(rec.method);
  const call = (method === 'get' || method === 'head')
    ? 'http.' + method + '(url, params);'
    : 'http.' + method + '(url, ' + (body ? 'body' : 'null') + ', params);';
  const lines = ["import http from 'k6/http';", "import { sleep } from 'k6';", '',
    'export default function () {',
    '  const url = ' + jsQuote(target(rec)) + ';',
    '  const params = ' + JSON.stringify(params, null, 2).split(NL).join(NL + '  ') + ';'];
  if (body) lines.push('  const body = ' + jsQuote(body) + ';');
  lines.push('  ' + call, '  sleep(1);', '}');
  return lines.join(NL);
}

/* ------------------------------- Ansible ---------------------------------- */
export function toAnsible(rec) {
  const lines = ['- name: INTERCEPTOR — ' + rec.method + ' ' + target(rec),
    '  hosts: localhost', '  gather_facts: false', '  tasks:',
    '    - name: Requete HTTP', '      ansible.builtin.uri:',
    '        url: ' + yq(target(rec)), '        method: ' + rec.method,
    '        return_content: true'];
  const heads = usableHeaders(rec);
  if (heads.length) {
    lines.push('        headers:');
    for (const h of heads) lines.push('          ' + yq(h.name) + ': ' + yq(h.value));
  }
  const body = bodyText(rec);
  if (body) {
    lines.push('        body: ' + yq(body, '        '));
    lines.push('        body_format: raw');
  }
  return lines.join(NL);
}

/* ----------------------------- Table + menu ------------------------------- */
export const CLIENTS = {
  ruby: toRuby, httparty: toHttParty,
  php: toPhp, guzzle: toGuzzle,
  go: toGo, rust: toRust,
  java: toJava, okhttp: toOkHttp, kotlin: toKotlin,
  csharp: toCSharp, restsharp: toRestSharp,
  swift: toSwift, dart: toDart,
  elixir: toElixir, r: toR, perl: toPerl, clojure: toClojure, objc: toObjC,
  axios: toAxios, jquery: toJquery, xhr: toXhr,
  httpx: toHttpx, k6: toK6, ansible: toAnsible
};

/** Menu groupe : chaque entree est { head } ou [cle, libelle]. */
export const CLIENT_MENU = [
  { head: 'Ruby' },
  ['ruby', 'Ruby (net/http)'], ['httparty', 'Ruby HTTParty'],
  { head: 'PHP' },
  ['php', 'PHP (cURL)'], ['guzzle', 'PHP Guzzle'],
  { head: 'Go, Rust' },
  ['go', 'Go (net/http)'], ['rust', 'Rust (reqwest)'],
  { head: 'JVM' },
  ['java', 'Java (java.net.http)'], ['okhttp', 'Java OkHttp'], ['kotlin', 'Kotlin (OkHttp)'],
  { head: '.NET' },
  ['csharp', 'C# (HttpClient)'], ['restsharp', 'C# RestSharp'],
  { head: 'Apple' },
  ['swift', 'Swift (URLSession)'], ['objc', 'Objective-C (NSURLSession)'],
  { head: 'Autres langages' },
  ['dart', 'Dart (package http)'], ['elixir', 'Elixir (Req)'], ['r', 'R (httr)'],
  ['perl', 'Perl (LWP)'], ['clojure', 'Clojure (clj-http)'],
  { head: 'JavaScript' },
  ['axios', 'axios'], ['jquery', 'jQuery.ajax'], ['xhr', 'XMLHttpRequest'],
  { head: 'Python, charge, automatisation' },
  ['httpx', 'Python httpx'], ['k6', 'k6 (test de charge)'], ['ansible', 'Ansible (module uri)']
];
