# Accéder aux sessions Claude Code du VPS depuis smartphone / tablette

Outillage d'exploitation du VPS Ubuntu (projets precogn, structory…). Sans rapport avec
le code de SheetToCsv : rangé ici pour être récupérable depuis le téléphone.

Le mécanisme est **Remote Control** : Claude Code continue de tourner sur le VPS, le
téléphone n'est qu'une fenêtre. Filesystem, serveurs MCP et configuration projet restent
sur la machine.

## A. Récupérer une session déjà en cours (30 secondes, depuis le téléphone)

Une app SSH — Termius, Blink, JuiceSSH — ou la console web de l'hébergeur. Puis :

```bash
tmux ls                    # les sessions qui tournent
tmux attach -t precogn     # entrer dans celle du projet
```

Dans la session Claude Code, taper :

```
/rc precogn
```

L'historique de conversation est conservé. La session apparaît aussitôt dans l'app
Claude → onglet **Code** (icône ordinateur, pastille verte), ou sur claude.ai/code.
`Ctrl+b` puis `d` pour détacher le tmux, et recommencer sur la session suivante.

## B. Installation permanente

```bash
bash ops/setup-claude-rc.sh --check                          # diagnostic seul, ne modifie rien
bash ops/setup-claude-rc.sh ~/projets/precogn ~/projets/structory
```

Le script :

1. contrôle les prérequis qui font échouer Remote Control **en silence** ;
2. pose `remoteControlAtStartup: true` → toute nouvelle session se connecte d'elle-même ;
3. crée un service systemd user par projet (serveur `claude remote-control` dans un tmux),
   avec *lingering* : survit à la déconnexion SSH et au reboot du VPS.

`--no-systemd` pour du tmux seul, sans service.

### Version minimale, si le script n'est pas à portée de main

```bash
sudo apt-get install -y tmux
python3 - <<'P'
import json, os
p = os.path.expanduser("~/.claude/settings.json"); os.makedirs(os.path.dirname(p), exist_ok=True)
d = json.load(open(p)) if os.path.exists(p) else {}
d["remoteControlAtStartup"] = True
json.dump(d, open(p, "w"), indent=2)
P
cd ~/projets/precogn && tmux new -d -s claude-precogn 'claude remote-control --name precogn'
loginctl enable-linger "$USER"
```

## Prérequis (leur absence est la cause n°1 d'échec)

| Point | Attendu |
| --- | --- |
| Plan | Pro, Max, Team ou Enterprise. **Une clé API ne fonctionne pas** — connexion via `/login`. |
| Version CLI | ≥ 2.1.51 ; `--continue` / `--session-id` demandent 2.1.200+. |
| `ANTHROPIC_BASE_URL` | Doit viser `api.anthropic.com`. Un proxy ou LLM gateway désactive Remote Control. |
| `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_GROWTHBOOK` | Aucune ne doit être définie : chacune coupe l'évaluation des feature flags dont Remote Control dépend. Vérifier le shell **et** le bloc `env` de `~/.claude/settings.json`. |
| Workspace trust | `claude` lancé au moins une fois dans chaque répertoire projet (jamais depuis le home). |

Sur Team/Enterprise, un Owner doit activer Remote Control dans les réglages admin
Claude Code.

## Exploitation

```bash
tmux attach -t claude-<projet>            # voir le serveur, barre espace = QR code
systemctl --user status  claude-rc-*
systemctl --user restart claude-rc-<projet>
journalctl --user -u claude-rc-<projet> -f
```

Après un `Ctrl+C` sur un serveur, `claude remote-control` relancé **dans le même
répertoire** récupère ses sessions pendant environ 4 heures.

## Référence

<https://code.claude.com/docs/en/remote-control>
