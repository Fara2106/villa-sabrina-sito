# Immagini di Villa Sabrina

Generato da `scripts/build-images.mjs`. **Non modificare i file in questa
cartella a mano**: vengono riscritti a ogni build. Per cambiare selezione,
ritagli o testi alternativi si modifica l'array `SELECTION` nello script.

Ultima generazione: 2026-07-30
Formati: WebP qualità 82 alle larghezze indicate, più un JPEG
progressivo a 1400px come fallback.

## Da sapere sulle sorgenti

Le foto professionali di Posarelli sono tutte **1920×1277**, quindi 2000 e
2600px non sono generabili da quelle: ingrandirle peggiorerebbe l'immagine e
il peso. Solo l'hero e le viste aeree, che vengono dal drone (**4000×2250**),
arrivano oltre i 1920px.

Nessuna sorgente è verticale: i ritratti 4:5 sono ritagli, con il centro di
interesse indicato da `focusX` nello script.

## File

| Nome | Ruolo | Dimensione intrinseca | Varianti | File originale | Origine |
|---|---|---|---|---|---|
| `hero-poster` | Hero — poster del video | 2600×1463 | WebP 800, 1400, 2000, 2600 + JPEG 1400 | `_poster-source.jpg` | Posarelli |
| `casa-vigna-torri-dallalto` | Galleria — esterno | 2000×1125 | WebP 800, 1400, 2000 + JPEG 1400 | `dji_fly_20260622_152504_43_1782135976157_photo_optimized.jpg` | drone |
| `fascia-colline-campi` | Fascia panorama 1 | 1920×320 | WebP 800, 1400, 1920 + JPEG 1400 | `31-villa-sabrina-outdoor-posarellivillas-24-.jpg` | Posarelli |
| `fascia-filari-vigna` | Fascia panorama 2 | 1920×320 | WebP 800, 1400, 1920 + JPEG 1400 | `12-villa-sabrina-outdoor-posarellivillas-18-.jpg` | Posarelli |
| `casa-facciata-porticato` | Ritratto — la casa | 1021×1276 | WebP 800, 1021 + JPEG 1024 | `13-villa-sabrina-outdoor-posarellivillas-8-.jpg` | Posarelli |
| `soggiorno-camino` | Spazi — soggiorno | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `04-villa-sabrina-posarellivillas-5-.jpg` | Posarelli |
| `camera-letto-baldacchino` | Spazi — camera | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `35-villa-sabrina-posarellivillas-32-.jpg` | Posarelli |
| `cucina-credenze-blu` | Spazi — cucina | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `19-villa-sabrina-posarellivillas-17-.jpg` | Posarelli |
| `piscina-lettini-ombrellone` | Spazi — piscina | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `01-villa-sabrina-outdoor-posarellivillas-34-.jpg` | Posarelli |
| `giardino-porticato-prato` | Spazi — giardino | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `23-villa-sabrina-outdoor-posarellivillas-12-.jpg` | Posarelli |
| `proprieta-dallalto-piscina` | Galleria — esterno | 2000×1125 | WebP 800, 1400, 2000 + JPEG 1400 | `dji_fly_20260622_161326_69_1782137753852_aeb.jpg` | drone |
| `piscina-cipressi-divano` | Galleria — esterno | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `17-villa-sabrina-outdoor-posarellivillas-30-.jpg` | Posarelli |
| `loggia-tavola-apparecchiata` | Galleria — esterno | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `46-villa-sabrina-outdoor-posarellivillas-43-.jpg` | Posarelli |
| `vista-colline-torri-san-gimignano` | Galleria — vista | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `27-villa-sabrina-outdoor-posarellivillas-19-.jpg` | Posarelli |
| `scalinata-fiorita` | Galleria — dettaglio | 1021×1276 | WebP 800, 1021 + JPEG 1024 | `63-villa-sabrina-outdoor-posarellivillas-40-.jpg` | Posarelli |
| `piscina-teli-lettino` | Galleria — dettaglio | 1021×1276 | WebP 800, 1021 + JPEG 1024 | `41-villa-sabrina-outdoor-posarellivillas-38-.jpg` | Posarelli |
| `bagno-ardesia-lavabo` | Galleria — interno | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `49-villa-sabrina-posarellivillas-18-.jpg` | Posarelli |
| `camera-finestra-colline` | Galleria — interno | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `44-villa-sabrina-posarellivillas-27-.jpg` | Posarelli |
| `scala-ferro-battuto` | Galleria — dettaglio | 1021×1276 | WebP 800, 1021 + JPEG 1024 | `34-villa-sabrina-posarellivillas-9-.jpg` | Posarelli |
| `cucina-dettaglio-piano-blu` | Galleria — interno | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `20-villa-sabrina-posarellivillas-33-.jpg` | Posarelli |
| `chiusura-tavola-arco-vista` | Chiusura | 1920×1280 | WebP 800, 1400, 1920 + JPEG 1400 | `53-villa-sabrina-outdoor-posarellivillas-48-.jpg` | Posarelli |

## Ritagli e correzioni applicate

- `casa-vigna-torri-dallalto` — ritaglio **hero**
- `fascia-colline-campi` — ritaglio **band**
- `fascia-filari-vigna` — ritaglio **band**
- `casa-facciata-porticato` — ritaglio **portrait**
- `proprieta-dallalto-piscina` — ritaglio **intero**, schiaritura gamma ×1.34 (lo scatto è il fotogramma sottoesposto della coppia AEB del drone: l'altro ha il 5% dell'inquadratura bruciata e non è recuperabile)
- `scalinata-fiorita` — ritaglio **portrait**
- `piscina-teli-lettino` — ritaglio **portrait**
- `scala-ferro-battuto` — ritaglio **portrait**

## Testi alternativi

Gli `alt` vivono nel dizionario delle traduzioni dentro `index.html`
(chiavi `alt.<nome-file>`). Qui sono riportati per riferimento.

- **hero-poster**
  - IT: La proprietà dall’alto: il giardino terrazzato, la piscina e la casa fra i cipressi
  - EN: The property from above: the terraced garden, the pool and the house among cypresses
- **casa-vigna-torri-dallalto**
  - IT: La villa fra i cipressi con la vigna e la piscina, e le torri di San Gimignano all’orizzonte
  - EN: The villa among cypresses with the vineyard and pool, and the towers of San Gimignano on the horizon
- **fascia-colline-campi**
  - IT: Le colline coltivate della campagna intorno a San Gimignano
  - EN: The cultivated hills of the countryside around San Gimignano
- **fascia-filari-vigna**
  - IT: Filari di vigna e cipressi visti dall’alto
  - EN: Rows of vines and cypress trees seen from above
- **casa-facciata-porticato**
  - IT: La facciata della casa in pietra e intonaco con il porticato e il prato davanti
  - EN: The stone and plaster façade of the house with its portico and the lawn in front
- **soggiorno-camino**
  - IT: Il soggiorno con il camino in muratura, le pareti gialle e le tende blu
  - EN: The living room with its masonry fireplace, yellow walls and blue curtains
- **camera-letto-baldacchino**
  - IT: La camera matrimoniale con letto a baldacchino e veli bianchi, pareti verdi e pavimento in cotto
  - EN: The double bedroom with a four-poster bed and white drapes, green walls and terracotta floor
- **cucina-credenze-blu**
  - IT: L’angolo cottura con le ante blu e il tavolo da pranzo in legno apparecchiato
  - EN: The kitchen corner with blue cabinet doors and the laid wooden dining table
- **piscina-lettini-ombrellone**
  - IT: La piscina con i lettini, le poltrone e il grande ombrellone, con le colline sullo sfondo
  - EN: The swimming pool with sun loungers, armchairs and a large parasol, hills in the background
- **giardino-porticato-prato**
  - IT: Il porticato attrezzato che si affaccia sul prato del giardino
  - EN: The furnished portico looking onto the garden lawn
- **proprieta-dallalto-piscina**
  - IT: La proprietà vista dall’alto: la casa, il giardino terrazzato fiorito e la piscina
  - EN: The property seen from above: the house, the terraced flowering garden and the pool
- **piscina-cipressi-divano**
  - IT: La piscina vista dal divano all’ombra, con la siepe e i cipressi
  - EN: The pool seen from the shaded sofa, with the hedge and cypress trees
- **loggia-tavola-apparecchiata**
  - IT: La tavola apparecchiata sotto la loggia in pietra, pronta per una cena all’aperto
  - EN: The table laid under the stone loggia, ready for dinner outdoors
- **vista-colline-torri-san-gimignano**
  - IT: La vista dalla proprietà: i filari, la valle e le torri di San Gimignano sul crinale
  - EN: The view from the property: the vine rows, the valley and the towers of San Gimignano on the ridge
- **scalinata-fiorita**
  - IT: La scalinata in pietra che sale nel giardino fra gli arbusti fioriti
  - EN: The stone staircase climbing through the garden between flowering shrubs
- **piscina-teli-lettino**
  - IT: Teli da bagno blu arrotolati sui lettini a bordo piscina
  - EN: Rolled blue pool towels on the sun loungers at the poolside
- **bagno-ardesia-lavabo**
  - IT: Il bagno rifatto, con lavabo d’appoggio su mensola in legno e specchio tondo retroilluminato
  - EN: The renovated bathroom, with a countertop basin on a wooden shelf and a round backlit mirror
- **camera-finestra-colline**
  - IT: La seconda camera con letto a baldacchino e la finestra aperta sulle colline
  - EN: The second bedroom with a four-poster bed and the window open onto the hills
- **scala-ferro-battuto**
  - IT: La scala interna con la ringhiera in ferro battuto
  - EN: The internal staircase with its wrought-iron railing
- **cucina-dettaglio-piano-blu**
  - IT: Dettaglio della cucina: il piano di lavoro blu, il muro in pietra e la cappa in acciaio
  - EN: Kitchen detail: the blue worktop, the stone wall and the steel extractor hood
- **chiusura-tavola-arco-vista**
  - IT: La tavola apparecchiata inquadrata dall’arco in pietra, con le colline oltre
  - EN: The laid table framed by the stone arch, with the hills beyond
