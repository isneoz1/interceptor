"""Verification independante de l export OpenAPI de SWIFT (by NeoZ).

Lit ce que produit tools/verifier-openapi.mjs et le soumet a
openapi-spec-validator et a jsonschema (Draft 2020-12, formats controles).
"""
import json, sys, os
from openapi_spec_validator import validate
from openapi_spec_validator.versions import consts
from jsonschema import Draft202012Validator, FormatChecker

dossier = sys.argv[1]
echecs = 0
for nom in ("openapi-scene.json", "openapi-extra.json"):
    with open(os.path.join(dossier, nom), encoding="utf-8") as f:
        doc = json.load(f)
    try:
        validate(doc)
        print("OpenAPI valide :", nom, "-", len(doc["paths"]), "chemins")
    except Exception as e:
        echecs += 1
        print("OpenAPI INVALIDE :", nom, e)

with open(os.path.join(dossier, "schemas.json"), encoding="utf-8") as f:
    paires = json.load(f)
verifs = 0
for i, p in enumerate(paires):
    schema = p["schema"]
    Draft202012Validator.check_schema(schema)
    v = Draft202012Validator(schema, format_checker=FormatChecker())
    for valeur in p["valeurs"]:
        erreurs = list(v.iter_errors(valeur))
        verifs += 1
        if erreurs:
            echecs += 1
            print("schema", i, "refuse un exemple :", erreurs[0].message[:200])
print(verifs, "exemples valides contre leur schema deduit (Draft 2020-12, formats verifies)")
print("ECHECS :", echecs)
sys.exit(1 if echecs else 0)
