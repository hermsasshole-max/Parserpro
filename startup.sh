#!/bin/sh
# Restart the ParserPro preview if it is not already answering.
cd /workspace || exit 1
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
PORT=8080 npm run dev > /tmp/parserpro-dev.log 2>&1 &
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
echo "ParserPro dev server did not start" >&2
tail -n 40 /tmp/parserpro-dev.log >&2 || true
exit 1
