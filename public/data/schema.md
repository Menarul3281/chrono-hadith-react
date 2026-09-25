# Chrono-Hadith Data Schema v1

Two entities for the isnad explorer: **narrators** and **hadiths**.

## narrator

| field       | type     | required | notes |
|-------------|----------|----------|-------|
| id          | string   | yes      | kebab-case, unique, stable |
| name        | string   | yes      | English display name |
| arabic      | string   | no       | Arabic script, no honorifics |
| kunya       | string   | no       | e.g. "Abu Hurayrah" |
| nasab       | string   | no       | patronymic line |
| birth       | string   | no       | free text (e.g. "c. 573 CE") |
| death       | string   | no       | free text |
| generation  | enum     | yes      | prophet \| sahabi \| tabii \| taba-tabii \| later \| compiler |
| role        | string   | no       | short label ("Companion", "Imam") |
| locations   | string[] | no       | cities |
| bio         | string   | no       | 1–3 sentence summary |
| teachers    | string[] | no       | narrator ids |
| students    | string[] | no       | narrator ids |
| sources     | string[] | no       | citation strings |
| verification| object   | no       | { status, note } — status: established \| review \| contested |

## hadith

| field         | type       | required | notes |
|---------------|------------|----------|-------|
| id            | string     | yes      | e.g. "bukhari-1" |
| collection    | string     | yes      | e.g. "Sahih al-Bukhari" |
| book          | string     | no       | topical book |
| number        | string     | yes      | hadith number in collection |
| reference     | string     | yes      | full reference |
| grade         | string     | no       | e.g. "Sahih" |
| arabic        | string     | no       | matn in Arabic |
| translation   | string     | yes      | English translation |
| narratorId    | string     | yes      | id of the companion narrating |
| chain         | ChainLink[]| yes      | ordered from Prophet to compiler |
| sourceUrl     | string     | no       | external reference |
| note          | string     | no       | scholarly note |

### ChainLink

| field      | type   | required | notes |
|------------|--------|----------|-------|
| narratorId | string | yes      | must resolve in narrators.json |
| role       | string | yes      | "Source" \| "Companion narrator" \| "Narrator" \| "Compiler" \| "Book" |
| generation | string | no       | display label for this chain position |
| note       | string | no       | optional per-link note |

## Rules

1. Every `chain[].narratorId` must exist in `narrators.json`.
2. The first chain link is always the Prophet ﷺ (`prophet`).
3. The last chain link is either the compiler or the book — never both.
4. `narratorId` on the hadith is the *first human narrator* after the Prophet.
5. No invented chains. If a chain isn't sourced, it doesn't ship.

## event (v2)

The Events page reads `events.json`. Dates and titles stay as they were for the
timeline lanes; the fields below are what the page adds.

| field         | type     | required | notes |
|---------------|----------|----------|-------|
| id            | string   | yes      | kebab-case, unique, stable |
| name          | string   | yes      | display title |
| year          | number   | yes      | CE; negative would be BCE |
| hijri         | string   | no       | e.g. `"2 AH"`. Only where the conversion is secure; omitted rather than guessed |
| era           | enum     | yes      | `pre-islamic` \| `prophetic` \| `rashidun` \| `umayyad` \| `abbasid` \| `later` |
| uiType        | enum     | yes      | `birth` \| `revelation` \| `migration` \| `battle` \| `treaty` \| `political` \| `social` \| `death` \| `other` — the sidebar taxonomy |
| type, category | string  | no       | the archive's own taxonomy, kept for the timeline lanes |
| placeId       | string   | no       | must resolve in `places.json`. `null` = no single documented site |
| zone          | enum     | no       | only when `placeId` is null: `Makkah` \| `Madinah` \| `Arabia` \| `Levant` \| `Egypt` \| `Persia` \| `Others` |
| dynastyIds    | string[] | yes      | may be empty. An association only where the sources place the event in that state's own history |
| participants  | string[] | yes      | narrator ids; unknown ids are dropped at read time |
| hadithIds     | string[] | yes      | reports that are *about* the event — not reports merely dated near it |
| quote         | object   | no       | `{ arabic, english, ref }` for a documented verse or report |
| summary       | string   | yes      | one sentence, shown in the list |
| context       | string   | yes      | the historical circumstances |
| significance  | string   | yes      | why the record matters in the archive |
| source        | string   | yes      | primary citation |
| color         | string   | no       | legacy accent used by the timeline lanes |

## dynasty

`dynasties.json`.

| field         | type     | required | notes |
|---------------|----------|----------|-------|
| id, name      | string   | yes      | `name` is the short form used on the map |
| arabic        | string   | no       | |
| full          | string   | no       | e.g. "Abbasid Caliphate" |
| type          | enum     | yes      | `Caliphate` \| `Dynasty` \| `Sultanate` \| `Emirate` \| `Kingdom` \| `Other` |
| typeNote      | string   | no       | the qualifier the sources add |
| start, end    | number   | yes      | CE |
| capital       | string   | yes      | display name |
| capitalIds    | string[] | no       | place ids; the earlier capitals are listed as well as the last |
| region        | enum     | yes      | the coarse filter bucket: `Arabia`, `Levant`, `North Africa`, `Al-Andalus`, `Persia`, `Central Asia`, `South Asia`, `Anatolia`, `Sub-Saharan Africa`, `Others` |
| regions       | string[] | yes      | the areas the sources name, for display |
| languages, religion, government | arrays/string | yes | |
| summary, contributions[], sources[] | | yes | |
| colour        | hex      | yes      | map, timeline and carousel accent |

## place (v2)

`places.json` is one gazetteer for the whole app: the timeline lanes read
`milestones`, the two dashboards read the coordinates.

| field      | type     | required | notes |
|------------|----------|----------|-------|
| id, name   | string   | yes      | |
| arabic     | string   | no       | |
| region     | string   | yes      | the area name |
| zone       | enum     | yes      | the Events page's region filter bucket |
| lat, lon   | number   | yes      | modern coordinates of the site, decimal degrees |
| approx     | boolean  | no       | the exact site is uncertain or disputed → the map says so |
| sources    | string[] | no       | |
| milestones | object[] | no       | `{ year, label }`; only the timeline lanes use them |

## ruler

`rulers.json`.

| field      | type   | required | notes |
|------------|--------|----------|-------|
| id, name   | string | yes      | |
| arabic     | string | no       | |
| dynastyId  | string | yes      | must resolve in `dynasties.json` |
| title      | string | yes      | Caliph, Sultan, Shah, Emperor… |
| start, end | number | yes      | reign years, CE |
| narratorId | string | no       | only when the ruler has a profile in `narrators.json`; otherwise the panel lists the name without a link |
| note       | string | no       | |
| source     | string | yes      | |

## world-land.json

Coastlines for the dynasty map and the event mini map, generated once from
Natural Earth 1:110m land (public domain, naturalearthdata.com), simplified to
about 0.35° and rounded to two decimals. **These are modern coastlines, drawn
for context only** — they say nothing about where a border ran. The dated
territory shapes live in `js/dynasty-geo.js` and are marked approximate there.

## book

`books.json` is the catalogue the Books page reads and the citations in the other
four datasets point at.

| field      | type     | required | notes |
|------------|----------|----------|-------|
| id, name   | string   | yes      | |
| arabic     | string   | no       | |
| category   | enum     | yes      | `Primary Source` \| `Hadith Collections` \| `Seerah & History` \| `Biographical Works` \| `Tafsir` \| `Fiqh` \| `Aqidah` \| `Language & Linguistics` \| `Adab & Ethics` \| `Sciences & Miscellaneous` |
| authors    | string[] | yes      | display names |
| authorIds  | string[] | yes      | narrator ids where the compiler is in the archive; empty otherwise |
| death      | number   | no       | CE. Omitted where the date is not secure — the era bucket then excludes the work rather than guessing |
| generation | string   | no       | the century as the sources state it |
| language, region | string | yes | |
| note       | string   | yes      | what the work is and how the archive uses it |
| sources    | string[] | yes      | the citation string the other records use; this is what links books to events and dynasties |

Counts on the Books page are never stored: `reports` per work is computed from
`hadiths.json` through `COLLECTION_TO_BOOK`, so the shelf and the Hadiths page can
never disagree.

