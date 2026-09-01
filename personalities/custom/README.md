# Custom personalities

Personalities you create live here. They behave exactly like the shipped ones —
`/personality <name>` locks them, aliases work, the session lock applies.

Ask Claude to "create a custom personality" and the `creating-a-personality`
skill will interview you and write the file.

**These files are gitignored.** Anything you create here stays local. If you make
one worth sharing, add it deliberately:

```bash
git add -f personalities/custom/your-character.md
```

To check a file you wrote or edited by hand:

```bash
node lib/cli-run.mjs lint personalities/custom/your-character.md
```
