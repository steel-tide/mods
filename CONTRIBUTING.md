# Submitting to Steel Tide Mods

These terms apply to new submissions and updates when the submitter expressly
accepts them in the pull request. They do not retroactively change earlier
submissions, existing mod licences or permissions already granted.

## Ownership and authority

You keep ownership of your contribution. Original authors, artists and other
rights holders keep ownership of their respective material. Submitting a mod
or port does not transfer copyright to Steel Tide or make you the owner of
someone else's work.

Submit only material you own or have permission to contribute under both its
stated licence and the registry permissions below. This includes definitions,
code, art, audio, maps, screenshots and documentation. Preserve upstream
credits, copyright notices and licence terms. If your existing permission
does not cover an intended use, obtain the rights holder's permission first.

## Each mod's licence

For a new mod, explicitly set `license` in `mod.json`. Include or link the
full licence text in the mod's directory; explain any component-specific
terms and credits there. A custom `LicenseRef-...` label must identify actual
terms, not stand in for missing permission. The licence must permit players
to download, install and play the mod in Steel Tide.

Existing mods retain their existing licences. An update must preserve those
terms unless the relevant rights holders authorize a change; a change cannot
withdraw permissions already granted for previously released material. The
manifest format's legacy CC-BY-4.0 default remains unchanged. It is not a
substitute for choosing and stating a licence for a new submission.

The tooling's PolyForm Strict licence does not apply to mods. The public's
rights to modify, redistribute or reuse a mod come from that mod's own terms,
separate permission from its rights holders, or applicable law.

## Permission to operate the registry

By accepting these terms for a submission, you grant the operators of the
official Steel Tide registry a non-exclusive, worldwide, royalty-free
permission, limited to the rights you own or are authorized to grant, to:

- Copy, store, validate and back up the submitted material, and host and
  distribute it through the official repository, release downloads, game
  clients, website and designated mirrors or delivery providers.
- Package it into supported download formats and generate registry metadata.
  This permits technical encoding and packaging, not changes to gameplay,
  creative content or the mod's licence.
- Display its name, description, credits and submitted screenshots to list
  and preview the mod, including resizing or cropping screenshots for those
  displays.

These permissions cover operating the official registry and delivering mods
to players even when Steel Tide's game or services are commercial. Delivery
providers may exercise them only on Steel Tide's behalf for these purposes.
Credits, copyright notices and applicable licence terms must be preserved
and made available with the distributed material.

This grant does not transfer ownership, authorize a separate sale of the mod,
authorize unrelated reuse, or let Steel Tide relicense it. Changes beyond the
technical processing above require permission under the mod's existing
licence or separate permission from the relevant rights holders. No additional
modification or redistribution rights are granted to the public by these terms.

If you want a listing removed, contact the maintainers through an issue or
the project's contact channel. Removing a listing cannot recall copies
already distributed or revoke rights already granted under a mod's licence;
repository history and necessary backups may retain earlier submissions.

## Making a submission

Follow the [README](README.md#adding-a-mod), run
`node tools/check.mjs mods/<id>`, and complete the pull request checklist.
The submitter must explicitly accept these terms; a maintainer must not
accept them on another creator's behalf without authorization.

## Tooling contributions

The repository tooling is covered by [LICENSE](LICENSE). PolyForm Strict
does not grant modification or redistribution rights. Ask the maintainers
for separate written permission before preparing tooling changes unless an
existing licence or other permission already authorizes them. Agree on the
licence for any tooling contribution before it is merged; these mod
submission terms do not assign ownership of tooling contributions.

Nothing in these terms limits rights under applicable law or GitHub's terms
for viewing and forking public repositories on GitHub.
