---
name: remote-control
description: Remet en service les sessions Claude Code Remote Control dans l'état de référence défini par remote-control/sessions.json, ou en donne l'état. Utiliser dès que l'utilisateur dit "remets le remote control", "les remote control sont déconnectés", "relance les sessions", "remote control HS", ou demande l'état des sessions Remote Control.
---

# Remettre le Remote Control

L'état de référence est `remote-control/sessions.json` à la racine du repo SheetToCsv.
`remote-control/README.md` documente le mécanisme complet.

## Règle d'or

Une session Remote Control est un process `claude` sur une machine de l'utilisateur.
Elle ne peut pas tourner si cette machine est éteinte. L'hôte doit être le **VPS**
(hostname historique `vps-03db771f`), **jamais le MSI**. Ne jamais laisser entendre
qu'un réglage pourrait rendre une session joignable avec son hôte éteint.

## Procédure

**1. Établir où on tourne.**

```bash
hostname
```

- **Sur l'hôte Remote Control (le VPS)** → exécuter directement, étape 2.
- **Ailleurs** (session cloud, conteneur, MSI) → pas d'accès à l'hôte. Passer à
  l'étape 4 : diagnostiquer à distance et donner la commande exacte à lancer.

**2. Remettre.**

```bash
systemctl --user start claude-remote-control && ~/.claude-rc/rc-status.sh
```

Si `~/.claude-rc/` n'existe pas, l'installation n'a jamais été faite :
lancer `remote-control/install.sh` depuis le repo.

**3. Vérifier.** `rc-status.sh` doit lister toutes les sessions du manifeste.
Une session absente a un `cwd` inexistant — le signaler avec le chemin fautif,
ne pas le corriger au hasard.

**4. Diagnostic à distance** (quand on n'est pas sur l'hôte).

Lister les sessions et lire leur état :

```
mcp__Claude_Code_Remote__list_sessions  (mine: true)
```

Pour chaque session `environment_kind: bridge` :

| Signal | Lecture |
|---|---|
| `connection_status: disconnected` | l'hôte ne répond plus |
| `last_init_error.error_kind: computer_unreachable` | machine éteinte, ou process mort |
| `last_init_error.error_kind: worker_auth_expired` | `recoverable: false` → `claude setup-token` requis sur l'hôte |
| Plusieurs sessions tombées dans la même fenêtre de temps | un seul hôte en cause, pas N pannes |

Puis donner à l'utilisateur la commande à lancer sur le VPS :

```bash
systemctl --user start claude-remote-control
```

## Modifier l'état de référence

Ajouter/retirer une session = éditer `remote-control/sessions.json`, puis
recopier vers `~/.claude-rc/sessions.json` sur l'hôte. Le timer reconcilie
dans les 5 min ; `systemctl --user start claude-remote-control` force tout de suite.

## Ne pas faire

- Ne pas proposer `bypassPermissions` pour des sessions non surveillées.
- Ne pas lancer les sessions hors tmux : `--remote-control` est interactif, il faut un pty.
- Ne pas relancer avec `nohup`/`&` en pensant que ça survit au reboot : c'est le rôle
  du service + du linger.
