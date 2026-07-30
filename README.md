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
scripts/check-*.mjs         verifiche (rendering, accessibilità)
Foto Posarelli (professionali)/   originali, mai modificati
Foto fatte da me/                 originali da drone, mai modificati
```

Le due cartelle di foto originali **non vengono mai toccate**: gli script le
aprono in sola lettura.

## Lingue

Il sito parla **italiano, inglese, francese e spagnolo**. I dizionari stanno
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
Italiano, inglese e francese sono presi dalle rispettive schede ufficiali
(`.it`, `.com`, `.fr`). **Lo spagnolo non esiste sulla loro piattaforma**:
quei testi sono la traduzione di quelli italiani — stessi dati, nessun dato
nuovo — e il pulsante "Precios y disponibilidad" porta alla scheda inglese,
che è l'unica disponibile.

Per aggiungere una lingua servono tre cose: un blocco in `I18N`, uno in `ALT`,
e l'aggiunta del codice in `LANGS`, `LOCALES` e `LISTING` (con l'URL della
scheda Posarelli in quella lingua, se esiste). Poi un pulsante nel selettore
in cima alla pagina e una riga `<link rel="alternate" hreflang>` nel `<head>`.

Posarelli ha già le schede in **tedesco, olandese, danese, norvegese e
svedese**: se un giorno servono, l'URL c'è già e il lavoro è solo il dizionario.
Le recensioni dicono che gli ospiti tedeschi sono i secondi per numero dopo
inglesi e americani.

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

### Approvare le recensioni

**Le nuove recensioni entrano nel JSON con `approved: false` e non compaiono
sul sito finché non le approvi.** È l'unico passaggio manuale, ed è voluto.

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
npm run check:a11y       # contrasti reali, tastiera, reduced-motion
npm run check:lighthouse # apre il report
```

Gli screenshot finiscono nella cartella temporanea indicata in cima a
`scripts/check-render.mjs`.

### Risultati misurati

Lighthouse, Chrome headless, server locale:

| | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Desktop | **100** | **100** | **100** | **100** |
| Mobile | **97** | **100** | **100** | **100** |

LCP 0,7 s desktop e 2,6 s mobile; CLS 0,005 e 0,002; TBT 0 ms. I numeri
mobile sono di tre corse consecutive che danno lo stesso risultato: una
singola corsa su una macchina occupata può scendere anche a 77, ed è rumore
della simulazione, non della pagina. Se misuri e ti esce un numero strano,
rimisura a macchina scarica prima di andare a cercare la causa.

Contrasti: tutti i testi passano AA, la maggior parte AAA. Il più stretto è
5,41:1 (il salvia `#93A18C` sul fondo alternato `#1D2B27`), contro un minimo
richiesto di 4,5:1.

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
