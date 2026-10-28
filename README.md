# Boxing Timer

Timer de boxe et de cardio fractionné, entièrement personnalisable. Il marche dans le navigateur, sur téléphone comme sur ordinateur, et peut s’installer sur l’écran d’accueil pour fonctionner hors connexion.

**➡️ https://ttekka.github.io/Boxing-Timer/**

## Ce qu’il fait

- **Rounds** : nombre de rounds, durée d’un round, repos entre les rounds.
- **Fractionné dans le round** : découpe chaque round en intervalles (ex. 20 s explosif / 10 s technique), avec un nom et une intensité par intervalle, et la séquence répétée autant de fois que voulu.
- **Séries** : répète tout le bloc de rounds, avec un repos plus long entre les séries.
- **Signaux** : cloche de ring au début et à la fin de chaque round, claquement d’alerte avant la fin du round (10 s par défaut), bips 3-2-1 avant chaque reprise, annonces vocales en option, vibrations sur Android.
- **Programmes** : Boxe amateur, Boxe pro, Shadow boxing, Fractionné sac, Tabata, HIIT 30/30, Circuit… et vos propres programmes enregistrés.
- **Grand affichage** en couleur selon la phase (jaune = préparation, rouge = round, orange = intervalle léger, vert = repos, bleu = repos entre séries), lisible de loin. Touchez n’importe où sur le chrono pour démarrer ou mettre en pause.
- L’écran reste allumé pendant la séance.

Raccourcis clavier : `Espace` démarrer / pause, `←` `→` étape précédente / suivante, `R` remise à zéro, `M` couper le son.

## Installer sur le téléphone

- **iPhone (Safari)** : bouton Partager → « Sur l’écran d’accueil ».
- **Android (Chrome)** : menu ⋮ → « Installer l’application ».

Pensez à désactiver le mode silencieux de l’iPhone pour entendre la cloche.

## Mise en ligne

Le site est publié automatiquement sur GitHub Pages à chaque push sur `main` (workflow `.github/workflows/deploy.yml`).

Première fois seulement : dans le dépôt GitHub, **Settings → Pages → Build and deployment → Source : « GitHub Actions »**, puis relancer le workflow depuis l’onglet **Actions** (ou pousser un commit).

## Développement

Aucune dépendance ni étape de build : du HTML, du CSS et du JavaScript (modules ES). Pour tester en local :

```sh
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

| Fichier | Rôle |
| --- | --- |
| `js/program.js` | Modèle d’un programme et construction de la séquence d’étapes |
| `js/timer.js` | Moteur du chrono (basé sur l’horloge, pas de dérive) |
| `js/audio.js` | Sons synthétisés (Web Audio) et annonces vocales |
| `js/app.js` | Écran principal et commandes |
| `js/settings.js`, `js/presets.js` | Réglages et liste des programmes |
| `sw.js` | Cache hors connexion (incrémenter `VERSION` à chaque mise en ligne) |
