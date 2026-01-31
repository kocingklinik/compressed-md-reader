# Compressed Markdown Reader

An Obsidian plugin that reads gzip-compressed markdown files (`.mdz`) to dramatically reduce vault storage requirements while maintaining full functionality.

## Why This Plugin?

If you're building a large knowledge base with thousands of markdown files, storage can become a real problem. This plugin solves that by:

- **Reducing storage by ~66%** - Compress your markdown files with gzip
- **Transparent reading** - `.mdz` files open and render just like regular markdown
- **Custom outline view** - Navigate headings with a dedicated outline panel
- **Keeping flexibility** - Files remain individually accessible and editable

Perfect for:
- 📚 Large reference libraries (Wikipedia, Grokipedia, etc.)
- 🗃️ Archive notes you want to preserve but rarely edit
- 💾 Reducing vault size for sync or backup
- 🌐 Offline knowledge bases with millions of articles

## Features

### Core Functionality
- ✅ Read `.mdz` (gzip-compressed markdown) files natively in Obsidian
- ✅ Automatic decompression on-the-fly (no manual extraction)
- ✅ Read-only by default (prevents accidental edits)
- ✅ Full text selection and copying
- ✅ Clickable links and interactive elements
- ✅ Individual file access (each `.mdz` is independently readable)

### Custom Outline View
- ✅ Dedicated outline panel for `.mdz` files
- ✅ Hierarchical heading tree (mimics native Obsidian outline)
- ✅ Search/filter headings
- ✅ Collapse/expand sections
- ✅ Click to jump to any heading
- ✅ Auto-scroll option

### Compression Tools
- ✅ Compress single markdown file to `.mdz`
- ✅ Bulk compress entire folders
- ✅ Compression stats (original size → compressed size)
- ✅ Reversible (can decompress back to `.md` anytime)

### Integration
- ⚠️ **Limited Obsidian integration** - `.mdz` files work as standalone read-only views
- ❌ Global search doesn't index `.mdz` content
- ❌ Backlinks panel doesn't detect links to/from `.mdz` files
- ❌ Graph view doesn't show `.mdz` connections
- ✅ Mobile compatible
- ✅ Works alongside regular `.md` files without conflicts

## Installation

### From Obsidian Community Plugins (Recommended)
*Coming soon - pending review*

### Build from Source
```bash
git clone https://github.com/kocingklinik/obsidian-compressed-markdown.git
cd obsidian-compressed-markdown
npm install
npm run build
```
make a folder inside to your vault's plugins folder.
Copy `main.js`, `manifest.json`, and `styles.css` to that folder.

## Usage

### Compressing Files

**Compress Current File:**
1. Open any `.md` file
2. Open Command Palette (`Ctrl/Cmd + P`)
3. Run: "Compress current markdown file to .mdz"
4. The compressed `.mdz` file is created in the same folder

**Bulk Compress Folder:**
1. Navigate to any folder with markdown files
2. Open Command Palette
3. Run: "Compress all markdown files in current folder"
4. All `.md` files in that folder are compressed to `.mdz`

**View Compression Stats:**
After compression, a notice shows:
```
Compressed: Example.md
Original: 95.3 KB
Compressed: 31.2 KB
Saved: 67.3%
```

### Reading Compressed Files

Simply click any `.mdz` file. It opens and renders just like regular markdown:
- Full text rendering
- Syntax highlighting
- Embedded images (if base64 encoded)
- Working links
- Selectable text

The custom outline panel appears automatically in the right sidebar.

### Editing Compressed Files

`.mdz` files are **read-only by default** (they're reference materials, not active notes).

**To edit a compressed file:**
1. Decompress it back to `.md` (manually, or with a future decompression command)
2. Make your edits
3. Re-compress if desired

This is intentional—reference materials should be preserved, not accidentally modified.

### Toggle Outline Panel

Command Palette → "Toggle .mdz outline panel"

The outline panel:
- Shows all headings in hierarchical tree
- Allows searching/filtering
- Click any heading to jump to that section
- Collapse/expand branches
- Auto-scroll option (follows your cursor)

## How It Works

### Compression Format
- Uses **gzip** compression (via `pako` library)
- Extension: `.mdz` (markdown + zip)
- Each file compressed individually (not a monolithic archive)
- ~66% average compression ratio on typical markdown files

### On-the-Fly Decompression
When you open a `.mdz` file:
1. Plugin reads the binary `.mdz` file
2. Decompresses with gzip (`pako.inflate`)
3. Renders the markdown content in memory
4. Parses headings for outline view

The file stays compressed on disk. Decompression happens in milliseconds.

### Current Limitations
**The plugin provides a read-only viewer for `.mdz` files, but does NOT integrate with Obsidian's global features:**

- ❌ **Search**: Obsidian's global search cannot index `.mdz` content (only searches `.md` files)
- ❌ **Backlinks**: Links to/from `.mdz` files are not tracked in the backlinks panel
- ❌ **Graph View**: `.mdz` files don't appear in the graph
- ❌ **Quick Switcher**: `.mdz` files may not appear in quick switcher results

**Workaround:**

For files you need to search/link frequently, keep them as `.md`. Use `.mdz` for:
- Reference materials you browse but rarely search
- Archive notes for occasional lookup
- Large knowledge bases where storage > searchability

## Real-World Performance

### Test Case: 1,500 Grokipedia Articles
| Metric | Value |
|--------|-------|
| Original size | 146.9 MB |
| Compressed size | 49.6 MB |
| Compression ratio | **66.2%** |
| Space saved | 97.3 MB |

### Extrapolation: 6 Million Articles
| Format | Storage Required |
|--------|------------------|
| Uncompressed `.md` | 500-600 GB |
| Compressed `.mdz` | **170-200 GB** |
| Savings | ~300-400 GB |

## Comparison: Individual Files vs. Archive

**Why not use a single `.zim`-style archive like Kiwix?**

| Approach | Pros | Cons |
|----------|------|------|
| **Single Archive** (Kiwix) | Better compression ratio | Can't edit individual files, all-or-nothing access, corruption risk |
| **Individual Files** (this plugin) | Edit any file, granular control, native file system | Slight compression overhead per file |

This plugin prioritizes **flexibility** over maximum compression. You can:
- Selectively download topics
- Edit individual articles
- Use standard file operations (search, sync, backup)
- Avoid corruption cascade (one bad file ≠ lost archive)

## Commands

| Command | Description |
|---------|-------------|
| `Compress current markdown file to .mdz` | Compress the active `.md` file |
| `Compress all markdown files in current folder` | Bulk compress all `.md` files in current folder |
| `Toggle .mdz outline panel` | Show/hide the custom outline view |

## Configuration

Currently, the plugin works out of the box with no settings required.

Future versions may include:
- [ ] Configurable compression level
- [ ] Auto-compress on file creation
- [ ] Batch decompression
- [ ] Exclude patterns (folders/files to skip)

## Compatibility

- **Obsidian Version:** 0.15.0 or higher
- **Desktop:** ✅ Windows, macOS, Linux
- **Mobile:** ✅ iOS, Android
- **Other Plugins:** Compatible with most plugins (some may not recognize `.mdz` files)

## Known Limitations

1. **No global search** - Obsidian's search doesn't index `.mdz` content
2. **No backlinks tracking** - Links to/from `.mdz` files aren't tracked
3. **No graph view** - `.mdz` files don't appear in the knowledge graph
4. **Read-only by default** - Editing requires decompression first
5. **No native editing** - Obsidian's live preview/source mode don't work on `.mdz`
6. **Plugin dependency** - `.mdz` files only work with this plugin installed

**Best Use Cases:**

Given these limitations, `.mdz` files work best for:
- 📚 **Reference libraries** - Encyclopedia articles, documentation you read but don't edit
- 🗃️ **Archives** - Old notes you want to preserve but rarely access
- 📖 **Read-only content** - Materials you consume rather than actively link to
- 💾 **Storage optimization** - When disk space is more valuable than searchability

## FAQ

**Q: Can I search inside `.mdz` files?**  
A: No. Obsidian's global search only works on `.md` files. You can read and manually browse `.mdz` files, but they won't appear in search results.

**Q: Will backlinks work with `.mdz` files?**  
A: No. Links to/from `.mdz` files are not tracked by Obsidian's backlinks panel or graph view.

**Q: Can I compress files with images?**  
A: Yes, if images are base64-encoded in the markdown. External image files are not compressed.

**Q: Will this work with my existing markdown files?**  
A: Absolutely. Compress any `.md` file to `.mdz` and it becomes readable by the plugin.

**Q: Can I decompress `.mdz` back to `.md`?**  
A: Currently requires manual decompression with gzip tools. A built-in decompression command is planned.

**Q: Does this work with Obsidian Sync?**  
A: Yes. `.mdz` files sync like any other file.

**Q: What happens if I uninstall the plugin?**  
A: `.mdz` files become unreadable in Obsidian. Keep backups of originals or decompress before uninstalling.

**Q: Should I compress my entire vault?**  
A: No. Only compress reference materials you rarely search or link to. Keep active notes as `.md` for full Obsidian functionality.

**Note:** This plugin is in active development. Backup your vault before using bulk compression features.
