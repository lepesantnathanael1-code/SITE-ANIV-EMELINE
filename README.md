# Site anniversaire Emeline

## Lancer la page principale en local

```powershell
.\local-server.ps1
```

La page principale est disponible sur :

```text
http://localhost:30000/
```

## Mettre la page message sur GitHub Pages

Le dossier `docs/` contient la page publique pour envoyer les messages. Dans GitHub, active Pages avec :

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

Puis configure l'URL du QR code avec ton pseudo GitHub :

```powershell
.\set-message-url.ps1 -GithubUser TON-PSEUDO -Repository SITE-ANIV-EMELINE
```

Ensuite, pousse le projet sur GitHub. Le QR code de la page locale pointera vers :

```text
https://TON-PSEUDO.github.io/SITE-ANIV-EMELINE/message.html
```

Les telephones en 5G pourront ouvrir cette page et les messages arriveront dans Supabase, puis s'afficheront sur l'ecran local.
