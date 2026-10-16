<!-- Adding or updating a mod? A short line on what it is, and this checklist.
For tooling-only changes, omit the mod checklist and describe the applicable
permission and licence agreed with the maintainers (see CONTRIBUTING.md). -->

- [ ] The folder is `mods/<id>/` and `<id>` is the `id` in its `mod.json`
- [ ] At least one screenshot of the mod in play, 4:3, under `screenshots/` and named in `mod.json`
- [ ] `node tools/check.mjs mods/<id>` passes
- [ ] `version` is bumped (an update) or `1.0.0` (a new mod)
- [ ] The mod's licence is explicitly declared, its terms are included or linked, and upstream credits and notices are preserved
- [ ] I own or am authorized to submit all included material under its stated terms and the registry permissions below
- [ ] I have read and accept the [submission terms](https://github.com/steel-tide/mods/blob/main/CONTRIBUTING.md), retaining creator ownership and granting the limited registry permissions described there
- [ ] Existing mod licences are preserved, or any authorized change and the rights holders' permission are explained in this pull request
- [ ] I tried it in the game (Settings → Mods → Open folder…)
