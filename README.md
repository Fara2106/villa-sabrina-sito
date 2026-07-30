# Villa Sabrina — sito vetrina

Sito di **Villa Sabrina**, casa vacanze con piscina a San Gimignano (Toscana),
commercializzata da **Posarelli Villas**.

Il sito non vende e non prenota: racconta la casa e manda il traffico alla
scheda ufficiale dell'agenzia, che resta l'unica fonte per prezzi,
disponibilità e prenotazione.

- Scheda IT — <https://www.posarellivillas.it/italia/toscana/san-gimignano/95494>
- Scheda EN — <https://www.posarellivillas.com/italy/tuscany/san-gimignano/95494>

## Com'è fatto

Una pagina statica, `index.html`, senza framework e senza backend. Tutto il
CSS e il JavaScript sono dentro il file.

```
index.html                  la pagina, unica
assets/img/                 immagini generate (WebP + fallback JPEG)
assets/img/MANIFEST.md      quale foto è quale, e da dove viene
data/reviews.json           le recensioni specchiate dalla scheda
scripts/fetch-reviews.mjs   scarica e aggiorna reviews.json
scripts/approve-reviews.mjs approva le recensioni da mostrare
scripts/build-site.mjs      inietta recensioni e JSON-LD in index.html
scripts/build-images.mjs    genera assets/img dalle foto originali
assets/video/               il filmato dell'hero e il suo poster
scripts/find-smooth-clip.mjs trova i tratti di volo fluidi nei video
scripts/check-*.mjs         verifiche (rendering, accessibilità, contrasti)
Foto Posarelli (professionali)/   originali, mai modificati
Foto fatte da me/                 originali da drone, mai modificati
Video fatti con il drone/         25 filmati originali, mai modificati
```

Le tre cartelle di originali **non vengono mai toccate**: gli script le aprono
in sola lettura. In tutto sono circa 4,8 GB e non stanno su GitHub.

## Il video dell'hero

Dietro il titolo scorre un filmato da drone di 12 secondi, `assets/video/hero-drone.mp4`
(984 KB). È un **di più, non contenuto**: non dice niente che non sia già nel
poster e negli `alt`. Perciò si carica solo se non disturba nessuno — schermo
largo, niente `prefers-reduced-motion`, niente `save-data`, niente rete lenta.
Su telefono resta la fotografia, che è anche l'elemento LCP.

Tre cose non ovvie, se un giorno lo rifai:

- **il poster è il primo fotogramma del video**, generato dal file
  `assets/video/_poster-source.jpg` estratto con ffmpeg e versionato apposta
  (il filmato originale, 163 MB, non sta nel repo). Se poster e primo
  fotogramma non coincidono, quando il video parte si vede lo scarto;
- **il ciclo va avanti e indietro.** Il volo si avvicina alla piscina: a fine
  clip, ripartendo, si vedrebbe uno stacco netto ogni 12 secondi. Il file
  contiene i 6 secondi in avanti seguiti dagli stessi 6 al contrario, quindi
  la giunta non esiste. Verificato: fra il primo e l'ultimo fotogramma ci sono
  2,4 livelli di differenza su 255;
- **il velo dell'hero è tarato sul fotogramma più chiaro del filmato**, non sul
  poster. Lo sfondo si muove, quindi il testo deve reggere il momento peggiore:
  `VS_WORST_FRAME=<file.png> npm run check:contrast`.

Il ritaglio non è stato scelto a occhio. `scripts/find-smooth-clip.mjs` misura
lo spostamento fra fotogrammi con la correlazione di fase e cerca la finestra
con l'accelerazione più bassa, cioè dove il drone si muove in modo costante
invece che a scatti:

```bash
node scripts/find-smooth-clip.mjs "Video fatti con il drone/"*.mp4 8
```

Punteggio basso = movimento regolare. Attenzione a un caso che sembra ottimo e
non lo è: un drone **fermo** ha accelerazione zero e vince sempre, ma come
video è inutile — tanto vale una fotografia. Per questo lo script penalizza
anche chi sta troppo fermo, e per questo il clip #123, bellissimo dall'alto, è
stato scartato: velocità 0,00, era un volo in stazionamento.

## Lingue

Il sito parla **italiano, inglese, francese, tedesco e spagnolo**. I dizionari stanno
nell'oggetto `I18N` dentro `index.html`, uno per lingua; i testi alternativi
delle foto stanno in `ALT`, con la stessa struttura.

La lingua si sceglie in quest'ordine: `?lang=` nell'indirizzo, poi la scelta
già ricordata nel browser, poi la lingua del browser; se nessuna corrisponde,
inglese. La scelta finisce nell'indirizzo, quindi un link si può condividere
già nella lingua giusta:

```
https://fara2106.github.io/villa-sabrina-sito/?lang=fr
```

**Da dove vengono i testi.** Posarelli pubblica la scheda in nove lingue.
Italiano, inglese, francese e tedesco sono presi dalle rispettive schede
ufficiali (`.it`, `.com`, `.fr`, `.de`). **Lo spagnolo non esiste sulla loro
piattaforma**: quei testi sono la traduzione di quelli italiani — stessi dati, nessun dato
nuovo — e il pulsante "Precios y disponibilidad" porta alla scheda inglese,
che è l'unica disponibile.

Per aggiungere una lingua servono tre cose: un blocco in `I18N`, uno in `ALT`,
e l'aggiunta del codice in `LANGS`, `LOCALES` e `LISTING` (con l'URL della
scheda Posarelli in quella lingua, se esiste). Poi un pulsante nel selettore
in cima alla pagina e una riga `<link rel="alternate" hreflang>` nel `<head>`.

Restano disponibili le schede Posarelli in **olandese, danese, norvegese e
svedese**: se un giorno servono, l'URL c'è già e il lavoro è solo il dizionario.
Dopo il tedesco, l'olandese è la lingua con più ospiti nelle recensioni.

## Per iniziare

```bash
npm install
npm run serve          # http://127.0.0.1:8788
```

Il sito funziona anche aprendo `index.html` con un doppio clic: le recensioni
sono incorporate nella pagina, non caricate via rete.

---

## Rigenerare le immagini

```bash
npm run images          # genera solo ciò che manca
npm run images:force    # rigenera tutto da capo
```

Lo script legge l'array `SELECTION` in `scripts/build-images.mjs`: lì stanno la
foto sorgente, il ruolo, l'eventuale ritaglio e i testi alternativi in italiano
e inglese. Per cambiare una foto si modifica quella riga e si rilancia.

Per ogni foto produce WebP qualità 82 alle larghezze indicate più un JPEG
progressivo di fallback, chiamato sempre `<nome>-fallback.jpg`.

Due cose da sapere prima di cambiare le larghezze:

- **le foto professionali di Posarelli sono tutte 1920×1277**, quindi 2000 e
  2600px non sono generabili da quelle. Lo script salta in silenzio le
  larghezze maggiori della sorgente invece di ingrandire;
- **nessuna sorgente è verticale.** I quattro ritratti 4:5 sono ritagli, con il
  centro di interesse regolato da `focusX`.

Dopo aver rigenerato le immagini, se sono cambiati i nomi va aggiornato anche
il markup in `index.html` (l'array `GALLERY` nel JavaScript e i `<picture>`
delle sezioni).

## Aggiornare le recensioni

Le recensioni vivono sulla scheda Posarelli. Qui se ne tiene una copia in
`data/reviews.json`, aggiornata da uno script.

**Prima si guarda, poi si scrive.** Il primo comando è sempre il dry-run:

```bash
npm run reviews:dry     # mostra cosa cambierebbe, non scrive niente
npm run reviews         # applica
```

Il dry-run stampa quante recensioni ha letto, quali sono nuove, quali sono
cambiate e quali sono sparite dalla scheda. Se il parsing non trova nulla lo
script **esce con errore e non scrive**, invece di sovrascrivere un file buono
con uno vuoto: vuol dire che Posarelli ha cambiato il markup e va aggiornata
la funzione `parseReviews()`.

Il fetch è uno per lingua, con `User-Agent` identificabile. Non c'è nessun
loop di richieste.

### Aggiornamento automatico

C'è un'azione GitHub, `.github/workflows/recensioni.yml`, che ogni **lunedì
mattina** controlla la scheda Posarelli. Si può lanciare anche a mano dal tab
*Actions* del repo.

Se trova qualcosa di nuovo:

1. aggiorna `data/reviews.json` e `index.html`, e fa commit;
2. **apre una issue** con l'elenco delle recensioni nuove, il testo di ciascuna
   e il comando per approvarle. Così arriva una mail e non serve ricordarsene.

Quello che si aggiorna **da solo** è il totale e la media — li dichiara
Posarelli, non c'è niente da decidere. Quello che **non** si aggiorna da solo è
quali recensioni si vedono: entrano sempre con `approved: false`. L'automazione
avvisa, non pubblica.

Per pubblicarle, dopo la mail:

```bash
git pull
npm run reviews:pending
npm run approve -- <id> <id>
npm run build && git push
```

Se un giorno Posarelli cambia il markup della pagina, lo script esce con
errore, l'azione fallisce e arriva comunque una notifica: meglio un'azione
rossa che un JSON svuotato in silenzio.

**Perché `fetchedAt` non cambia a ogni controllo.** Se non è cambiato niente di
sostanziale, `fetch-reviews.mjs` non riscrive affatto il file. Senza questa
regola il timestamp si aggiornerebbe ogni volta, il file risulterebbe sempre
modificato, e l'azione farebbe un commit e aprirebbe un avviso ogni lunedì
anche a fronte di zero novità — dopo un mese quegli avvisi non li leggerebbe
più nessuno. Conseguenza voluta: la data in fondo alla pagina è quella
dell'ultimo **cambiamento**, non dell'ultimo controllo, che è poi l'unica che
interessi a chi legge.

### Approvare le recensioni

Di norma non devi fare niente: **l'automazione pubblica da sola le recensioni
nuove da 5 stelle**, e ferma tutto ciò che sta sotto.

La soglia non è pigrizia. Oggi tutte e 61 le recensioni sono 5/5: far
approvare a mano una cosa che si approva sempre non è controllo, è un
promemoria che dopo tre mesi si ignora. Ma questa è la vetrina della casa, non
un aggregatore: il giorno che arriva una recensione tiepida deve fermarsi e
farla leggere a una persona, invece di comparire da sola.

```bash
npm run reviews          # nessuna approvazione automatica (comportamento base)
npm run reviews:auto     # pubblica le nuove da 5 stelle, ferma il resto
node scripts/fetch-reviews.mjs --auto-approve=4   # soglia diversa
```

Per cambiare la soglia dell'automazione si modifica il flag in
`.github/workflows/recensioni.yml`. Per tornare all'approvazione tutta manuale
basta togliere `--auto-approve` da quel file.

**Le decisioni già prese non vengono mai toccate**: se hai revocato una
recensione a mano, resta revocata anche quando l'automazione ripassa. L'auto
approvazione vale solo per le recensioni che non hai mai visto.

```bash
npm run reviews:pending                       # quelle ancora da valutare
npm run reviews:list                          # tutte, con id e stato
npm run approve -- 33fe5a6b2b56 d16e3cab4429  # approva
npm run approve -- --revoke 33fe5a6b2b56      # torna indietro
npm run build                                 # riscrive index.html
```

Va bene anche aprire `data/reviews.json` in un editor e mettere `"approved":
true` a mano: lo script è solo una comodità.

L'`id` di ogni recensione è l'hash di autore + testo, quindi **una recensione
già approvata resta approvata anche dopo un nuovo fetch**, e cambiare l'ordine
sulla scheda non fa danni.

### Testo integrale invece dell'estratto

Di default il sito mostra un estratto di ~180 caratteri con un link alla
scheda, perché quei testi li hanno scritti gli ospiti e sono pubblicati sulla
piattaforma dell'agenzia.

Quando arriva da Posarelli l'autorizzazione scritta a ripubblicarli per
intero, si cambiano **due** costanti e si rilancia il build:

- `REVIEWS_FULL_TEXT` in `index.html` (dentro il tag `<script>` finale)
- `REVIEWS_FULL_TEXT` in `scripts/build-site.mjs`

Devono restare uguali: la prima governa il testo visibile, la seconda il
`reviewBody` dei dati strutturati, e Google vuole che coincidano.

## Pubblicare

`npm run build` prima di ogni pubblicazione: è il comando che riscrive in
`index.html` il blocco delle recensioni approvate e il JSON-LD.

```bash
npm run reviews:dry && npm run reviews   # se ci sono novità
npm run approve -- <id> …                # se vuoi mostrarle
npm run build                            # sempre
```

Poi si caricano sul server questi file e basta:

```
index.html
assets/img/
```

`data/`, `scripts/`, `node_modules/` e le due cartelle di foto originali **non
servono in produzione**. Va bene qualsiasi hosting statico (Netlify, Vercel,
GitHub Pages, o un normale spazio FTP).

Se usi Netlify o Vercel, il comando di build è `npm run build` e la cartella
da pubblicare è la radice del progetto.

## Verifiche

```bash
npm run serve            # in un terminale
npm run check:render     # 360/768/1280/1920: overflow, 404, screenshot
npm run check:a11y       # contrasti su fondo pieno, tastiera, reduced-motion
npm run check:contrast   # contrasto del testo che sta SOPRA le foto
npm run check:lighthouse # apre il report
```

I due controlli sui contrasti servono a cose diverse, e il secondo è quello
che conta di più qui.

`check:a11y` risale il DOM finché trova un `background-color`, quindi funziona
solo dove dietro c'è un colore pieno. **Dove dietro c'è una fotografia non
vede niente e non dice niente**: hero, fasce panorama e chiusura passavano
senza essere mai misurate davvero.

`check:contrast` misura sul serio: nasconde il testo, fotografa l'area che
occupava e confronta il colore del testo con **ogni singolo pixel** dello
sfondo, tenendo il caso peggiore. Se cambi una foto, un ritaglio o un
gradiente, è questo il comando da rilanciare.

Due trappole che ha già preso, se un giorno lo modifichi:

- il `clip` di `page.screenshot()` è in coordinate **di pagina**, non di
  viewport: senza sommare `scrollX/scrollY` si fotografa un'altra zona;
- i rettangoli di `Range.getClientRects()` sono gonfiati da ascendente e
  discendente del font e sbordano sul testo vicino. Con il Bodoni a 158px il
  titolo sconfinava nel sottotitolo, che è dello stesso crema: il risultato
  era un finto 1:1 inamovibile. Vanno ritagliati sulla scatola dell'elemento.

Gli screenshot finiscono nella cartella temporanea indicata in cima a
`scripts/check-render.mjs`.

### Risultati misurati

Lighthouse, Chrome headless, server locale:

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Desktop | **100** | **100** | **100** | **100** |
| Mobile | **97** | **100** | **100** | **100** |

Il video non peggiora i numeri: su desktop parte dopo il `load`, su mobile non
viene nemmeno richiesto.

LCP 0,7 s desktop e 2,6 s mobile; CLS 0,005 e 0,002; TBT 0 ms. I numeri
mobile sono di tre corse consecutive che danno lo stesso risultato: una
singola corsa su una macchina occupata può scendere anche a 77, ed è rumore
della simulazione, non della pagina. Se misuri e ti esce un numero strano,
rimisura a macchina scarica prima di andare a cercare la causa.

Bersagli da toccare: tutti almeno 44×44px a 390px di larghezza. Il selettore
delle lingue partiva da 11px di altezza — l'area sensibile e stata allargata
col padding senza cambiare il disegno.

Contrasti su fondo pieno: tutti AA, la maggior parte AAA. Il più stretto è
5,41:1 (il salvia `#93A18C` sul fondo alternato `#1D2B27`), contro un minimo
richiesto di 4,5:1.

Contrasti del testo sopra le foto, misurati pixel per pixel a 390 e 1440px:
tutti passano, il più stretto è 4,72:1. I veli sull'hero, sulle fasce e sulla
chiusura sono tarati su questo, non a occhio: il caso più difficile è
l'occhiello oro `#D6B45C`, piccolo e spaziato, sopra un campo in pieno sole.
**Se cambi la foto dell'hero rilancia `npm run check:contrast`**, perché il
velo è tarato su quella immagine.

## Dati e vincoli

- **Niente prezzi nel sito.** Sono stagionali e alcune voci si saldano sul
  posto: la pagina rimanda sempre alla scheda ufficiale.
- **Niente informazioni inventate.** Tutto ciò che è scritto viene dalla scheda
  Posarelli. Se un dato non è lì, non sta nel sito.
- **Le recensioni non vengono tradotte.** Si mostrano nella lingua originale,
  con l'etichetta della lingua accanto all'autore: è più credibile di una
  traduzione automatica e mostra che la clientela è internazionale.
- CIN della struttura: `IT052028B4JQ4QGLI6`.

## Diritti sulle immagini

Le 78 foto in `Foto Posarelli (professionali)/` sono dell'agenzia o del
fotografo. Le riprese da drone in `Foto fatte da me/` sono di proprietà.
L'autorizzazione all'uso delle foto professionali sul sito va chiesta a
Posarelli **insieme** a quella per il testo integrale delle recensioni: è lo
stesso permesso e conviene chiederlo una volta sola.
