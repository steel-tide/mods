# UCGR-RE localization source

`localization.json` is keyed by the original Rusted Warfare `core.name`. It covers 462 source definitions in `阵营单位/`, `阵营选择/`, `支援/` and `中立及通用单位/`. Each entry supplies `name` and `desc` as `[en, zh, ko]`.

The English and Chinese authored names and core descriptions are preserved, including equipment designations, source grading, fiction, credits and existing textual errors. Source `${...}` constants have been expanded by `rw.py`; literal `\n` line breaks are decoded. No live expression is carried into the translated strings. The sole content correction is the inherited Chinese placeholder `占位描述` in 56 English descriptions, translated to `Placeholder description`; these are mostly implementation helpers and should not be exposed as playable units merely because they have localized text.

Korean translates the full descriptive text and semantic portions of unit names. Model codes, ammunition designations, unit measurements, handles credited as artists, and the source's grade letters are retained. A name consisting only of a model designation may therefore be identical across languages. The descriptions retain source behavior claims; they are evidence for the port and do not certify that an unsupported mechanic works in Steel Tide. The playable manifest must be reviewed against the adaptation report.

The selected MVP names and descriptions were reviewed together. Korean formatting removes two obvious source typing artifacts (`]n[` in BREM-1 and a trailing `c` in PGZ09) while the authored English and Chinese remain unchanged. Medium infantry armour is translated as “중간 수준의 장갑”; numeric type designations use ordinary Korean spacing, such as “89식”. No equipment specifications or supported-behaviour claims were added by this review.

Keys beginning `adaptation-` supply localized labels for the approved Steel Tide adaptation (field supply depot, engineer, command-post actions and national labels). Their descriptions are empty until their exact behavior is assigned. They are not source unit identifiers.
