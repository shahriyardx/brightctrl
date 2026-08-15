#!/bin/bash
# Waybar custom module for brightctrl.
#
#   brightness.sh          emit waybar JSON for the current state
#   brightness.sh up       raise every monitor by $BRIGHTNESS_STEP (default 5)
#   brightness.sh down     lower every monitor by $BRIGHTNESS_STEP
#
# Reads through `--fast`, which is served from brightctrl's monitor cache and
# returns in about a millisecond. A full scan takes seconds, so it must never
# end up on this path.

set -o pipefail

STEP=${BRIGHTNESS_STEP:-5}

if ! command -v brightctrl >/dev/null 2>&1; then
  printf '{"text":"󰃟 --","tooltip":"brightctrl is not installed","class":"error"}\n'
  exit 0
fi

state=$(brightctrl list --json --fast 2>/dev/null)
if [ -z "$state" ] || [ "$state" = "[]" ]; then
  printf '{"text":"󰃟 --","tooltip":"No DDC/CI monitors detected","class":"error"}\n'
  exit 0
fi

case "$1" in
up | down)
  # Nudge every monitor, clamped to 0-100. Writes are sequential; each one is
  # a few milliseconds because `set` resolves from the cache too.
  python3 -c "
import json, subprocess, sys
step = int(sys.argv[2]) * (1 if sys.argv[1] == 'up' else -1)
for m in json.loads(sys.argv[3]):
    target = max(0, min(100, m['brightness'] + step))
    subprocess.run(['brightctrl', 'set', m['id'], str(target)],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
" "$1" "$STEP" "$state"
  state=$(brightctrl list --json --fast 2>/dev/null)
  ;;
esac

# The bar shows the brightest monitor; the tooltip breaks out every display by
# its alias, falling back to the model name when no alias is set.
python3 -c "
import json, sys
mons = json.loads(sys.argv[1])
top = max(m['brightness'] for m in mons)
icon = '󰃠' if top >= 66 else ('󰃟' if top >= 33 else '󰃞')
rows = '\n'.join(f\"{m['alias'] or m['name']}: {m['brightness']}%\" for m in mons)
print(json.dumps({
    'text': f'{icon} {top}%',
    'tooltip': rows,
    'class': 'connected',
}, ensure_ascii=False))
" "$state"
