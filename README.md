# oliver_loo_portfolio

Static portfolio site. No build step, no dependencies, no external requests.

```
index.html          the page. All copy lives here, edit it directly
style.css           six themes. Palettes are the [data-section] blocks at the top
script.js           theme switching on scroll, reveal animations, matrix rain
resume.html         print-styled résumé, the source for the PDF
Oliver-Loo-CV.pdf   generated from resume.html, linked from the Hire section
assets/             app icons, game sprites, product screenshots
JOB-SEARCH.md       the LinkedIn workflow, not part of the site
```

## Before anything else: your transcripts

Your NUS transcript, your student status letter (which carries your NRIC and
date of birth) and your Stanford transcript were sitting in this folder. Every
file here becomes a public URL the moment you deploy, so I moved all three to
`~/Desktop/oliver_loo_private_docs/`. Nothing was deleted.

`.gitignore` and `.vercelignore` now block every PDF except the CV, so this
can't happen again if you drop another document in here.

## Preview locally

```bash
python3 -m http.server 8777
```

Then open http://localhost:8777

## Fill these in before publishing

Three placeholders are left. Search and replace:

| Placeholder | File | What to put |
|---|---|---|
| `YOUR-GITHUB-HANDLE` | `index.html`, 2 places | Your GitHub username |
| `PLAY-URL-HERE` | `index.html`, Langfun card | Where the playable game is hosted. Delete that `<p class="card-links">` line until it exists |
| `OLIVER-PORTFOLIO-URL` | `resume.html` | This site's URL once it's live, then regenerate the PDF |

Everything else is real: the Levanta App Store link, your LinkedIn, your phone
number and email are all wired up.

## The avatar (needs your photos)

The floating avatar changes persona per section and opens a chat panel. Right
now it shows an "OL" monogram because the image files don't exist yet. Drop
these into `assets/avatar/` and it picks them up automatically. No code change
needed, and any file that's missing just falls back to the monogram.

| File | Section | Persona |
|---|---|---|
| `thesis.jpg` | hero | professional headshot |
| `builder.jpg` | Build | builder |
| `hacker.jpg` | Break | hacker |
| `artist.jpg` | Feel | artist |
| `life.jpg` | Path | off the clock, tennis or ski |
| `hire.jpg` | Hire | approachable, available |

Square crops, roughly 300×300, are ideal.

**About the Seedance morph video.** The avatar is currently six stills swapped by
section, which is the version that works today. If you produce the morph video
instead, tell me and I'll swap the `<img>` for a scrubbed `<video>` so the
persona transition animates between sections rather than cutting.

## The chat answers

All nine questions and answers live in the `ANSWERS` array in
[script.js](script.js), in the avatar section. Edit the text there and nothing
else changes. It runs entirely locally with no API key and no network call. When
you want a real model behind it, replace the `reply()` function and leave the
rest alone.

## Regenerating the résumé PDF

Edit `resume.html`, then:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="Oliver-Loo-CV.pdf" --virtual-time-budget=4000 "file://$PWD/resume.html"
```

It is tuned to fit exactly one A4 page. If you add a bullet, check it still fits.

## Deploy

**Vercel**, free with a custom domain:

```bash
npx vercel --prod
```

**GitHub Pages**: push this folder to a repo called
`YOUR-GITHUB-HANDLE.github.io`, then Settings, Pages, source `main`.

Buy a domain and point it here. `oliverloo.com` on a résumé reads better than
a `vercel.app` subdomain.

## How the theming works

Each `<section>` carries `data-theme`. An IntersectionObserver in `script.js`
works out which section covers most of the viewport and writes that name to
`<html data-section="...">`. Every colour, font and radius is a CSS variable
redefined per theme, so the whole page cross-fades when the subject changes.

The Break section additionally runs a canvas matrix rain, which starts and stops
based on that same attribute so it costs nothing anywhere else on the page.

Reveal animations are progressive enhancement: content is visible by default and
only starts hidden once `script.js` confirms it is running, so a JavaScript
failure can never leave a blank page.

## Hosting the games

Both Langfun games are Expo projects and export to static web:

```bash
cd ~/Desktop/french_game && npx expo export --platform web
```

That writes `dist/`. Deploy it at `/play/oui-chef`, then point `PLAY-URL-HERE`
at it. Worth doing. A recruiter who can play your game in one click remembers you.
