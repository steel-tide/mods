# Steel Tide Mods

The public registry of mods for [Steel Tide](https://steelti.de), the cross-platform RTS.
A mod adds **units, buildings and upgrade levels** — described in one `mod.json`,
with sprite sheets beside it if the author drew some — and every folder under
`mods/` here is listed in the game under _Settings → Mods_ and on
[steelti.de/mods](https://steelti.de/mods).

- **Play one:** in the game, _Settings → Mods → Official registry → Install_, or
  open `https://play.steelti.de/?mod=<id>`.
- **Make one:** read the [modding guide](https://steelti.de/wiki/modding) — the
  whole format, generated from the game's own validator — or give it to a
  coding agent as a skill: `npx skills add steel-tide/skills --skill steel-tide-mods-guideline`
  ([skills.sh](https://skills.sh), from [steel-tide/skills](https://github.com/steel-tide/skills);
  the same text is [`AGENTS.md`](AGENTS.md)).
- **Publish one:** read the [submission terms](CONTRIBUTING.md), fork, add
  `mods/<id>/`, run the check, and open a pull request. Creators keep ownership.

## Adding a mod

For a new submission, explicitly set `license` in `mod.json` and include or
link the applicable licence text and credits. Choose terms you have the right
to offer; the tooling's licence does not apply to your mod. The format's
legacy CC-BY-4.0 default is unchanged, but new submissions must state their
licence explicitly. See [ownership and submission permissions](CONTRIBUTING.md).

```
mods/<id>/
  mod.json          the manifest — `id` must equal the folder name
  sprites/*.png     the sheets it names, if any
  sfx/*.mp3         the recordings it names, if any
  screenshots/*.png the mod in play: at least one, 4:3 (1600×1200 is a good
                    size), under 2 MB each, named under `screenshots` in mod.json
  README.md         a few lines on what it is (shown nowhere yet, read by people)
```

```sh
node tools/check.mjs mods/<id>      # every error with its path into mod.json
node tools/pack.mjs mods/<id>       # optional: one file to share if its licence permits
```

The check is the one the game runs on load, plus what only the registry can
know: the folder is named after the id, every sheet exists, the screenshots
are there and 4:3, and no def id, alias or sheet key is taken by another
published mod. **Ids are global** — prefix a generic word with your mod's id
(`ironworks-bunker`, not `bunker`). CI runs the same check on every pull
request; once merged, `index.json` is rebuilt on `main` and the mod is live.

The screenshots are what the game's mod list and [steelti.de/mods](https://steelti.de/mods)
show for the mod; the first is its card. Take them in a match with the mod's
units on screen (the console's `give <faction> <unit id> <n>` puts them there)
and crop to 4:3.

Bump `version` for every change: the game offers the update to whoever has
the mod installed.

## What is here

| Path                                     | What                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mods/<id>/`                             | one mod each; `mods/ironworks` has its own art and sounds, a turreted building and an upgrade level; `mods/rusted-expansion` is the official Rusted Warfare tribute |
| `index.json`                             | what the game and the website read — generated, never edited by hand; carries each mod's download count and screenshot sizes                                        |
| `tools/check.mjs`                        | validate one mod or all of them                                                                                                                                     |
| `tools/build-index.mjs`                  | rebuild `index.json` (CI does this on `main`, and nightly for the counts)                                                                                           |
| `tools/pack.mjs`                         | a mod folder into the single-file form the game's _Upload file…_ takes                                                                                              |
| `tools/sync-release.mjs`                 | keep the `registry` release in step with `mods/`: every mod packed as an asset, which is how the download counts are kept (CI)                                      |
| `tools/steel-tide-mod.mjs`               | the game's own mod code — validator, resolver, the vanilla roster — bundled from the game repository; do not edit here                                              |
| `AGENTS.md`                              | the brief for a coding agent: the whole format, how to test, how to publish                                                                                         |
| `mods/<id>/PROMPTS.md`, `SFX-PROMPTS.md` | how a mod's sheets were painted and its sounds recorded, where they were generated                                                                                  |

## Download counts

There is no database. CI packs every mod into its single-file form and
attaches it to the rolling [`registry` release](https://github.com/steel-tide/mods/releases/tag/registry);
GitHub counts downloads of a release asset, and installing a mod from the
game's registry list fetches that asset's URL once. The counts are read back
off the release nightly and on every push and baked into `index.json`, which
is the figure the game and the website show; a changed mod is re-uploaded and
its old count carried over. The packed files are also the one-file form of
each mod, for anyone who wants it.

## Licence

The registry tooling is **source available, not open source**, under
[PolyForm Strict License 1.0.0](LICENSES/PolyForm-Strict-1.0.0.txt). It permits
noncommercial use and personal study, but grants no permission to modify or
redistribute the tooling. Those activities and uses outside the licence
require separate permission, except where existing rights already allow them.
See [LICENSE](LICENSE) for the scope and retained rights from earlier releases.

**Mods and their assets remain owned by their creators and other respective
rights holders.** Each mod keeps the licence declared in its `mod.json` and
its accompanying notices. PolyForm Strict does not replace those licences:
existing CC-BY-4.0, PolyForm Noncommercial and custom mod licences remain in
effect. Check the individual mod's terms before modifying, sharing or reusing it.

The [submission terms](CONTRIBUTING.md) give Steel Tide limited, non-exclusive
permission to host, package, distribute and display submitted mods through
the official registry, game, website and mirrors, while preserving credits
and licences. Submission does not transfer copyright or give Steel Tide
blanket permission to relicense or sell a creator's mod.
