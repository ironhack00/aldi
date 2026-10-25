#!/usr/bin/env bash
#
# Prueba de humo de la API.
#
# Recorre el flujo completo contra una instancia en ejecucion y verifica las
# reglas que mas facil se rompen al tocar el backend: permisos por rol,
# validacion de campos dinamicos, calculo de indicadores y el ciclo de sesion.
#
# Es idempotente: trabaja con deltas sobre el estado inicial y borra todo lo
# que crea, asi que se puede correr muchas veces sobre la misma base.
#
# Uso:
#   API_URL=http://localhost:3001 ./scripts/smoke-test.sh
#
set -uo pipefail

API="${API_URL:-http://localhost:3001}/api"
PASS="${SEED_PASSWORD:-Demo1234!}"
TMP=$(mktemp -d)
COOKIES="$TMP/cookies.txt"
# Sufijo unico: evita chocar con datos de una corrida anterior.
SUFIJO=$(date +%s)
fallos=0

trap 'rm -rf "$TMP"' EXIT

check() { # <descripcion> <1|0>
  if [ "$2" = "1" ]; then echo "  OK    $1"; else echo "  FALLA $1"; fallos=$((fallos+1)); fi
}
jq_() { python3 -I -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

echo "== 1. Autenticacion =="
login=$(curl -s -c "$COOKIES" -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"admin@demo.com\",\"password\":\"$PASS\"}")
TOKEN=$(echo "$login" | jq_ 'd.get("accessToken","")')
AUTH="authorization: Bearer $TOKEN"
check "login de admin devuelve access token" "$([ -n "$TOKEN" ] && echo 1 || echo 0)"
check "cookie httpOnly de refresh seteada" "$(grep -q desvios_rt "$COOKIES" && echo 1 || echo 0)"

code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d '{"email":"admin@demo.com","password":"incorrecta"}')
check "password incorrecta rechazada (401, fue $code)" "$([ "$code" = "401" ] && echo 1 || echo 0)"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API/deviations")
check "endpoint protegido sin token (401, fue $code)" "$([ "$code" = "401" ] && echo 1 || echo 0)"

echo "== 2. Estado inicial =="
curl -s "$API/fields" -H "$AUTH" > "$TMP/campos.json"
base_campos=$(jq_ 'len(d["fields"])' < "$TMP/campos.json")
base_cats=$(curl -s "$API/catalogs" -H "$AUTH" | jq_ 'len(d["catalogs"])')
base_desvios=$(curl -s "$API/deviations?pageSize=1" -H "$AUTH" | jq_ 'd["total"]')
echo "  (base: $base_cats catalogos, $base_campos campos, $base_desvios desvios)"
cascadas=$(jq_ 'sum(1 for x in d["fields"] if x["dependsOn"])' < "$TMP/campos.json")
check "hay campos en cascada definidos ($cascadas)" "$([ "$cascadas" -ge "1" ] && echo 1 || echo 0)"

echo "== 3. Permisos por rol =="
op=$(curl -s -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"operador@demo.com\",\"password\":\"$PASS\"}" | jq_ 'd["accessToken"]')
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/catalogs" -H "authorization: Bearer $op" \
  -H 'content-type: application/json' -d '{"key":"prohibido","name":"Prohibido"}')
check "operador no puede crear catalogos (403, fue $code)" "$([ "$code" = "403" ] && echo 1 || echo 0)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$API/users" -H "authorization: Bearer $op")
check "operador no puede listar usuarios (403, fue $code)" "$([ "$code" = "403" ] && echo 1 || echo 0)"

echo "== 4. Alta de desvio con campos dinamicos =="
# Los ids de las opciones se resuelven por etiqueta, igual que hace el frontend.
python3 -I - "$TMP/campos.json" > "$TMP/payload.json" <<'PY'
import json, sys
campos = {c["key"]: c for c in json.load(open(sys.argv[1]))["fields"]}
def opt(key, label, parent=None):
    for o in campos[key]["options"]:
        if o["label"] == label and (parent is None or o["parentId"] == parent):
            return o["id"]
    raise SystemExit(f"opcion no encontrada: {label} en {key}")
prob, causa = opt("problema", "Contaminacion"), opt("causa", "Supervision")
print(json.dumps({
  "occurredOn": "2026-10-10", "raisedOn": "2026-10-14",
  "values": {
    "especie": opt("especie", "S. frugiperda"),
    "lote": "SMOKE-TEST",
    "actividadResponsable": opt("actividadResponsable", "Inoculacion"),
    "actividadDeteccion": opt("actividadDeteccion", "Colecta"),
    "problema": prob,
    "especificacion": opt("especificacion", "Contaminacion de dieta", prob),
    "impacto": opt("impacto", "Critico"),
    "causa": causa,
    "causaEspecifica": opt("causaEspecifica", "Falta de supervision operativa", causa),
  }}))
PY
curl -s -X POST "$API/deviations" -H "$AUTH" -H 'content-type: application/json' \
  -d @"$TMP/payload.json" > "$TMP/creado.json"
DESVIO_ID=$(jq_ 'd.get("deviation",{}).get("id","")' < "$TMP/creado.json")
dcode=$(jq_ 'd.get("deviation",{}).get("code","")' < "$TMP/creado.json")
check "desvio creado, codigo generado en el servidor ($dcode)" "$([ -n "$DESVIO_ID" ] && echo 1 || echo 0)"
v=$(jq_ 'd["deviation"]["diasHastaDeteccion"]' < "$TMP/creado.json")
check "dias hasta deteccion = 4 (fue $v)" "$([ "$v" = "4" ] && echo 1 || echo 0)"
v=$(jq_ 'd["deviation"]["distanciaEtapas"]' < "$TMP/creado.json")
check "distancia Inoculacion->Colecta = 4 etapas (fue $v)" "$([ "$v" = "4" ] && echo 1 || echo 0)"

echo "== 5. Validaciones =="
v=$(curl -s -X POST "$API/deviations" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"occurredOn":"2026-10-01","raisedOn":"2026-10-02","values":{}}' | jq_ 'd.get("error",{}).get("code","")')
check "campos obligatorios faltantes rechazados ($v)" "$([ "$v" = "BAD_REQUEST" ] && echo 1 || echo 0)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/deviations" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"occurredOn":"2026-10-20","raisedOn":"2026-10-10","values":{}}')
check "fechas invertidas rechazadas (422, fue $code)" "$([ "$code" = "422" ] && echo 1 || echo 0)"
v=$(curl -s -X POST "$API/deviations" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"occurredOn":"2026-10-01","raisedOn":"2026-10-02","values":{"especie":"id-inventado"}}' \
  | jq_ 'd.get("error",{}).get("code","")')
check "opcion de catalogo inexistente rechazada ($v)" "$([ "$v" = "BAD_REQUEST" ] && echo 1 || echo 0)"

echo "== 6. Listado, busqueda y metricas =="
v=$(curl -s "$API/deviations?pageSize=1" -H "$AUTH" | jq_ 'd["total"]')
check "el total subio en 1 ($base_desvios -> $v)" "$([ "$v" = "$((base_desvios+1))" ] && echo 1 || echo 0)"
v=$(curl -s "$API/deviations?search=SMOKE-TEST" -H "$AUTH" | jq_ 'd["total"]')
check "busqueda por valor de texto (fue $v)" "$([ "$v" = "1" ] && echo 1 || echo 0)"
v=$(curl -s "$API/deviations?search=frugiperda" -H "$AUTH" | jq_ 'd["total"]')
check "busqueda por etiqueta de catalogo (fue $v)" "$([ "$v" -ge "1" ] && echo 1 || echo 0)"

curl -s "$API/metrics/summary" -H "$AUTH" > "$TMP/metricas.json"
v=$(jq_ 'd["summary"]["totalDesvios"]' < "$TMP/metricas.json")
check "metricas: total coincide con el listado (fue $v)" "$([ "$v" = "$((base_desvios+1))" ] && echo 1 || echo 0)"
v=$(jq_ 'len(d["summary"]["porDiaSemana"])' < "$TMP/metricas.json")
check "metricas: los 7 dias de la semana presentes (fueron $v)" "$([ "$v" = "7" ] && echo 1 || echo 0)"
v=$(jq_ 'd["summary"]["promedioDeteccion"]' < "$TMP/metricas.json")
check "metricas: promedio calculado ($v dias)" "$([ -n "$v" ] && echo 1 || echo 0)"

echo "== 7. Campo creado desde el panel =="
CAMPO_ID=$(curl -s -X POST "$API/fields" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"key\":\"smoke$SUFIJO\",\"label\":\"Smoke $SUFIJO\",\"type\":\"TEXT\"}" | jq_ 'd.get("field",{}).get("id","")')
check "campo nuevo creado" "$([ -n "$CAMPO_ID" ] && echo 1 || echo 0)"
v=$(curl -s "$API/fields" -H "$AUTH" | jq_ "sum(1 for f in d['fields'] if f['key']=='smoke$SUFIJO')")
check "aparece en el formulario sin deploy" "$([ "$v" = "1" ] && echo 1 || echo 0)"

echo "== 8. Catalogos =="
CAT_ID=$(curl -s -X POST "$API/catalogs" -H "$AUTH" -H 'content-type: application/json' \
  -d "{\"key\":\"smoke-$SUFIJO\",\"name\":\"Smoke $SUFIJO\"}" | jq_ 'd.get("catalog",{}).get("id","")')
check "catalogo nuevo creado" "$([ -n "$CAT_ID" ] && echo 1 || echo 0)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/catalogs/$CAT_ID/items" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"label":"Valor A"}')
check "item agregado (201, fue $code)" "$([ "$code" = "201" ] && echo 1 || echo 0)"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$API/catalogs/$CAT_ID/items" -H "$AUTH" \
  -H 'content-type: application/json' -d '{"label":"Valor A"}')
check "item duplicado rechazado (409, fue $code)" "$([ "$code" = "409" ] && echo 1 || echo 0)"
sis=$(curl -s "$API/catalogs" -H "$AUTH" | jq_ '[x["id"] for x in d["catalogs"] if x["key"]=="especies"][0]')
code=$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API/catalogs/$sis" -H "$AUTH")
check "catalogo de sistema protegido (409, fue $code)" "$([ "$code" = "409" ] && echo 1 || echo 0)"

echo "== 9. Baja logica de un item en uso =="
usado=$(jq_ "[o['id'] for o in {c['key']:c for c in d['fields']}['especie']['options'] if o['label']=='S. frugiperda'][0]" < "$TMP/campos.json")
v=$(curl -s -X DELETE "$API/catalogs/items/$usado" -H "$AUTH" | jq_ 'd["eliminado"]')
check "item referenciado se desactiva, no se borra (eliminado=$v)" "$([ "$v" = "False" ] && echo 1 || echo 0)"
# Se vuelve a activar para no alterar el estado de la demo.
curl -s -X PATCH "$API/catalogs/items/$usado" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"isActive":true}' > /dev/null

echo "== 10. Modulo de analisis =="
v=$(curl -s "$API/analysis/provider" -H "$AUTH" | jq_ 'd["provider"]')
check "motor activo informado ($v)" "$([ -n "$v" ] && echo 1 || echo 0)"
curl -s -X POST "$API/analysis/ask" -H "$AUTH" -H 'content-type: application/json' \
  -d '{"question":"Cuanto tardamos en detectar los desvios?"}' > "$TMP/ia.json"
resp=$(jq_ 'd["answer"]' < "$TMP/ia.json")
ev=$(jq_ 'len(d.get("evidence",[]))' < "$TMP/ia.json")
check "responde con texto" "$([ -n "$resp" ] && echo 1 || echo 0)"
check "acompana la respuesta con evidencia numerica ($ev cifras)" "$([ "$ev" -gt "0" ] && echo 1 || echo 0)"
echo "        -> $resp"

echo "== 11. Ciclo de sesion =="
v=$(curl -s -b "$COOKIES" -c "$COOKIES" -X POST "$API/auth/refresh" | jq_ '"si" if d.get("accessToken") else "no"')
check "refresh entrega un access token nuevo" "$([ "$v" = "si" ] && echo 1 || echo 0)"
curl -s -b "$COOKIES" -X POST "$API/auth/logout" > /dev/null
code=$(curl -s -o /dev/null -w '%{http_code}' -b "$COOKIES" -X POST "$API/auth/refresh")
check "tras logout el refresh token queda revocado (401, fue $code)" "$([ "$code" = "401" ] && echo 1 || echo 0)"

echo "== 12. Limpieza =="
# Se vuelve a autenticar porque el logout anterior cerro la sesion.
TOKEN=$(curl -s -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"admin@demo.com\",\"password\":\"$PASS\"}" | jq_ 'd["accessToken"]')
AUTH="authorization: Bearer $TOKEN"
[ -n "$DESVIO_ID" ] && curl -s -X DELETE "$API/deviations/$DESVIO_ID" -H "$AUTH" > /dev/null
[ -n "$CAMPO_ID" ]  && curl -s -X DELETE "$API/fields/$CAMPO_ID"     -H "$AUTH" > /dev/null
[ -n "$CAT_ID" ]    && curl -s -X DELETE "$API/catalogs/$CAT_ID"     -H "$AUTH" > /dev/null

fin_cats=$(curl -s "$API/catalogs" -H "$AUTH" | jq_ 'len(d["catalogs"])')
fin_campos=$(curl -s "$API/fields" -H "$AUTH" | jq_ 'len(d["fields"])')
fin_desvios=$(curl -s "$API/deviations?pageSize=1" -H "$AUTH" | jq_ 'd["total"]')
check "catalogos restaurados ($base_cats -> $fin_cats)" "$([ "$fin_cats" = "$base_cats" ] && echo 1 || echo 0)"
check "campos restaurados ($base_campos -> $fin_campos)" "$([ "$fin_campos" = "$base_campos" ] && echo 1 || echo 0)"
check "desvios restaurados ($base_desvios -> $fin_desvios)" "$([ "$fin_desvios" = "$base_desvios" ] && echo 1 || echo 0)"

echo
if [ "$fallos" = "0" ]; then
  echo "TODAS LAS PRUEBAS PASARON"
else
  echo "$fallos PRUEBA/S FALLARON"
fi
exit "$fallos"
