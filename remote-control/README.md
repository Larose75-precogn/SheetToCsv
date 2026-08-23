# Remote Control persistant

Faire tourner les sessions Claude Code Remote Control sur un hôte **toujours allumé**,
pour qu'elles restent joignables depuis le téléphone **MSI éteint**.

## Pourquoi l'ancien setup est tombé

Une session Remote Control **est** un process `claude` sur une machine à toi ; le cloud
ne fait que relayer. Machine éteinte = plus de process = `computer_unreachable`.

Le 21/08/2026, les 7 sessions sont tombées entre 14:35 et 14:48 UTC. Elles étaient
toutes marquées `recoverable: true` — mais **rien n'était en place pour les relancer**,
donc elles sont restées mortes 2 jours.

Ce dossier corrige les deux causes :

| Cause | Correctif |
|---|---|
| Hôte qui s'éteint | Installation sur le VPS, pas sur le MSI |
| Rien ne relance | Timer systemd qui réconcilie toutes les 5 min |
| Meurt à la déconnexion SSH | `loginctl enable-linger` |
| Auth qui expire (`worker_auth_expired`) | `claude setup-token` |

## Installation (sur le VPS)

Une seule commande :

```bash
git clone -q -b claude/remote-control-disconnected-up31x3 --depth 1 \
  https://github.com/Larose75-precogn/SheetToCsv.git /tmp/rc && /tmp/rc/remote-control/install.sh
```

`install.sh` refuse de tourner en root, vérifie les prérequis, copie tout dans
`~/.claude-rc/`, installe les units systemd user, active le linger et démarre.

## Usage courant

```bash
systemctl --user start claude-remote-control   # remettre le Remote Control
~/.claude-rc/rc-status.sh                      # état
systemctl --user stop claude-remote-control    # arrêter
tmux -L claude-rc attach -t rc                 # voir les sessions en direct
```

## Le manifeste

`sessions.json` est la **source de vérité** : l'état à restaurer. `rc-up.sh` le rejoue.

```json
{
  "defaults": { "model": "claude-opus-4-8", "effort": "high", "permission_mode": "acceptEdits" },
  "sessions": [
    { "name": "Structory.ai/compta" },
    { "name": "Game", "cwd": "/home/user/jeux/game", "model": "claude-fable-5" }
  ]
}
```

`name` devient le nom affiché de la session (`claude --remote-control "<name>"`).
Chaque session peut surcharger `model`, `effort`, `permission_mode`.

**`cwd` est optionnel.** Le répertoire de travail n'était pas récupérable depuis les
métadonnées cloud, donc `rc-up.sh` le retrouve seul : il cherche sous `$HOME` un dossier
portant le nom de la session (`Structory.ai/compta` → `compta`), en ignorant
`node_modules`, `.git` et `.cache`. Sans correspondance, il réessaie mot par mot
(`Structory investor deck narrative restructure` → `deck`).

- une seule correspondance → utilisée, et le chemin retenu est affiché
- plusieurs → session ignorée, candidats listés, à toi de trancher via `cwd`
- aucune → session ignorée avec le motif

Jamais de démarrage au mauvais endroit en silence. Renseigne `cwd` seulement si la
détection hésite ou se trompe. Racine de recherche ajustable via `RC_SEARCH_ROOTS`.

## Fonctionnement

Chaque session tourne dans une fenêtre `tmux` dédiée sur le socket `claude-rc`
(`claude --remote-control` est une commande interactive : il lui faut un pty).

`rc-up.sh` est **idempotent** : il compare les fenêtres vivantes au manifeste et ne
démarre que ce qui manque. C'est pour ça qu'il peut tourner toutes les 5 min sans
rien dupliquer, et qu'il fait à la fois installateur et réparateur.

## Limites

- Les sessions redémarrées sont **neuves** : elles reprennent le nom et la config,
  pas l'historique de conversation. Les ID cloud (`session_01...`) et les ID locaux
  (UUID) sont deux espaces distincts ; `--resume` attend un ID local, donc reprendre
  une conversation cloud morte par son ID n'est pas fiable et n'est pas tenté ici.
- `permission_mode` par défaut est `acceptEdits`, comme l'ancien setup.
  `bypassPermissions` n'est volontairement pas utilisé.
- La détection de chemin s'appuie sur le nom des dossiers. Si tes projets ne portent
  pas un nom proche de celui des sessions, renseigne `cwd` explicitement.
