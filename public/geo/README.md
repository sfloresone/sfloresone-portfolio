# GeoJSON assets for the visitor choropleth

## `countries-110m.geojson`

- **Source:** [Natural Earth 110m Admin 0 Countries](https://github.com/nvkelso/natural-earth-vector)
- **License:** [Public Domain](https://github.com/nvkelso/natural-earth-vector/blob/master/LICENSE.md)
- **Match key:** feature property `ISO_A2` → API `locationKey` (e.g. `FR`, `US`)

## `spain-ccaa.geojson`

- **Source:** [koldLight/curso-r-dataviz](https://github.com/koldLight/curso-r-dataviz/blob/master/dat/spain_ccaas.geojson) (CCAA boundaries); `code` property added from official community names.
- **`provinces` field:** ISO 3166-2:ES province codes per CCAA ([Wikipedia](https://en.wikipedia.org/wiki/ISO_3166-2:ES)). Used client-side to resolve API keys like `ES-M` (province) or `ES-MD` (CCAA) to a choropleth feature.
- **Match key:** feature property `code` → resolved CCAA code (e.g. `ES-M` → `MD`, legacy `ES:MD` → `MD`)
