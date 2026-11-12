# Decky Builds guide format (version 1)

One JSON file is one guide. It attaches to a game by its Steam `appid`, so it shows up under that game in the library and in the "Now playing" card while the game runs.

Upload it from a browser on your PC: turn on **Accept file uploads** in the Decky Builds panel, open the address shown there, enter the pairing code and drop the file in. Files must end in `.json` and be at most 1 MB. Uploading a guide with an `id` that already exists replaces it and keeps your checklist ticks and last-read section.

For editor autocompletion, point your editor at `docs/schema/guide-1.schema.json`. The plugin's own check is stricter (unique ids, table row lengths), and it tells you exactly where a problem is, for example:

```
sections[1].blocks[0] (table): row 4 has 3 cells, but the table has 4 columns.
```

## Top level

| Field | Required | Type | Notes |
|---|---|---|---|
| `format` | yes | `"decky-builds.guide"` | |
| `version` | yes | `1` | |
| `id` | yes | string | 1–64 characters: lowercase letters, digits, dashes. Starts with a letter or digit. Same id = same guide. |
| `title` | yes | string | Shown in lists. Can be renamed on the Deck. |
| `game` | yes | `{ "appid": int, "name": string }` | Find the appid in the game's Steam store URL. |
| `author` | no | string | |
| `updated` | no | `"YYYY-MM-DD"` | |
| `tags` | no | list of strings | Searchable in the library. |
| `summary` | no | string | One or two sentences. |
| `sections` | yes | list of sections | At least one. Each section is one page in the viewer. |

Unknown top-level fields are ignored, so newer guides still load.

A **section** is `{ "id": string, "title": string, "blocks": [Block, …] }`. Section ids must be unique within the guide.

## Text ("Rich")

Anywhere the tables below say *Rich*, you can write:

- a plain string: `"Level Vigor first."`
- one span: `{"b": "Vigor"}`
- a list mixing both: `["Level ", {"b": "Vigor"}, " first."]`

| Span | Meaning |
|---|---|
| `{"b": "…"}` | bold |
| `{"i": "…"}` | italic |
| `{"hl": "…"}` | highlighted value |
| `{"btn": "R1"}` | controller button glyph: `A B X Y L1 R1 L2 R2 L4 R4 L5 R5 START SELECT DPAD` |

## Blocks

Every block has a `type`.

| `type` | Fields | On the Deck |
|---|---|---|
| `text` | `text`: Rich | A paragraph |
| `heading` | `text`: Rich | A sub-heading (skipped by D-pad focus) |
| `list` | `style`?: `"bullet"` \| `"number"`, `items`: [Rich] | |
| `checklist` | `id`: string, `items`: [`{ "id": string, "text": Rich }`] | A ticks an item. Ticks are saved per `checklistId:itemId`, so keep ids stable when you update a guide. Checklist ids are unique within the guide, item ids within the checklist, and neither may contain `:`. |
| `table` | `caption`?: string, `columns`: [`{ "label": string, "align"?: "left"\|"right"\|"center" }`], `rows`: [[cell, …]], `stickyFirstColumn`?: bool | A enters cell mode, X sorts. Every row must have exactly one cell per column. A cell is a string, a number or Rich. |
| `stats` | `items`: [`{ "label": string, "value": string }`] | A row of key-fact tiles |
| `callout` | `tone`: `"tip"` \| `"warning"` \| `"note"`, `title`?: string, `text`: Rich | A coloured box |

Images are not supported in version 1.

## Minimal example

```json
{
  "format": "decky-builds.guide",
  "version": 1,
  "id": "my-first-guide",
  "title": "My first guide",
  "game": { "appid": 413150, "name": "Stardew Valley" },
  "sections": [
    {
      "id": "start",
      "title": "Start here",
      "blocks": [
        { "type": "text", "text": ["Press ", { "btn": "A" }, " to tick items below."] },
        { "type": "checklist", "id": "todo", "items": [
          { "id": "seeds", "text": "Plant the parsnip seeds" },
          { "id": "mines", "text": "Visit the Mines" }
        ] }
      ]
    }
  ]
}
```

Longer examples are in `tests/guides/`.
