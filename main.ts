import {
  Plugin,
  TFile,
  WorkspaceLeaf,
  MarkdownView,
  Notice,
  CachedMetadata,
  HeadingCache,
  Pos,
  ItemView,
  setIcon,
} from "obsidian";
import { inflate, gzip } from "pako";

const VIEW_TYPE_COMPRESSED_MD = "compressed-markdown-view";
const VIEW_TYPE_CUSTOM_OUTLINE = "compressed-markdown-outline";
const COMPRESSED_EXTENSION = "mdz";

export default class CompressedMarkdownPlugin extends Plugin {
  private customMetadataCache: Map<string, CachedMetadata> = new Map();
  private originalGetFileCache: Function | null = null;

  async onload() {
    console.log("Loading Compressed Markdown Plugin");

    this.patchGetFileCache();

    this.registerView(
      VIEW_TYPE_COMPRESSED_MD,
      (leaf) => new CompressedMarkdownView(leaf, this),
    );

    this.registerView(
      VIEW_TYPE_CUSTOM_OUTLINE,
      (leaf) => new CustomOutlineView(leaf, this),
    );

    this.registerExtensions([COMPRESSED_EXTENSION], VIEW_TYPE_COMPRESSED_MD);

    // Listen for file open events
    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        this.handleFileOpen(file);
      }),
    );

    // Listen for active leaf change (tab switching)
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        this.handleActiveLeafChange(leaf);
      }),
    );

    this.addCommand({
      id: "compress-current-file",
      name: "Compress current markdown file to .mdz",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          if (!checking) {
            this.compressFile(file);
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "compress-all-markdown",
      name: "Compress all markdown files in current folder",
      callback: () => {
        this.bulkCompress();
      },
    });

    this.addCommand({
      id: "toggle-custom-outline",
      name: "Toggle .mdz outline panel",
      callback: () => {
        this.toggleCustomOutline();
      },
    });
  }

  handleFileOpen(file: TFile | null): void {
    if (file && file.extension === COMPRESSED_EXTENSION) {
      this.ensureCustomOutlineVisible();
      this.updateAllOutlineViews();
    } else {
      this.hideCustomOutline();
    }
  }

  handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
    // Cast to any to access file property (not all views have it)
    const file = (leaf?.view as any)?.file as TFile | undefined;

    if (file && file.extension === COMPRESSED_EXTENSION) {
      this.ensureCustomOutlineVisible();
      this.updateAllOutlineViews();
    } else if (file) {
      // Not a .mdz file, hide custom outline
      this.hideCustomOutline();
    }
  }

  updateAllOutlineViews(): void {
    const outlineLeaves = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CUSTOM_OUTLINE,
    );
    outlineLeaves.forEach((leaf) => {
      const view = leaf.view as CustomOutlineView;
      view.updateOutline();
    });
  }

  ensureCustomOutlineVisible(): void {
    const existing = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CUSTOM_OUTLINE,
    );

    if (existing.length === 0) {
      this.app.workspace.getRightLeaf(false).setViewState({
        type: VIEW_TYPE_CUSTOM_OUTLINE,
        active: true,
      });
    }
  }

  hideCustomOutline(): void {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CUSTOM_OUTLINE);
    leaves.forEach((leaf) => leaf.detach());
  }

  toggleCustomOutline(): void {
    const existing = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_CUSTOM_OUTLINE,
    );

    if (existing.length > 0) {
      existing.forEach((leaf) => leaf.detach());
    } else {
      this.app.workspace.getRightLeaf(false).setViewState({
        type: VIEW_TYPE_CUSTOM_OUTLINE,
        active: true,
      });
    }
  }

  patchGetFileCache(): void {
    try {
      const metadataCache = this.app.metadataCache as any;
      this.originalGetFileCache =
        metadataCache.getFileCache.bind(metadataCache);

      const plugin = this;
      metadataCache.getFileCache = function (file: TFile) {
        if (file && file.extension === COMPRESSED_EXTENSION) {
          const customCache = plugin.customMetadataCache.get(file.path);
          if (customCache) {
            return customCache;
          }
        }
        return plugin.originalGetFileCache!(file);
      };

      console.log("✅ Patched getFileCache");
    } catch (error) {
      console.error("❌ Failed to patch getFileCache:", error);
    }
  }

  restoreGetFileCache(): void {
    try {
      if (this.originalGetFileCache) {
        const metadataCache = this.app.metadataCache as any;
        metadataCache.getFileCache = this.originalGetFileCache;
      }
    } catch (error) {
      console.error("❌ Failed to restore getFileCache:", error);
    }
  }

  setCustomMetadata(filePath: string, metadata: CachedMetadata): void {
    this.customMetadataCache.set(filePath, metadata);
    this.updateAllOutlineViews();
  }

  clearCustomMetadata(filePath: string): void {
    this.customMetadataCache.delete(filePath);
  }

  getCustomMetadata(filePath: string): CachedMetadata | undefined {
    return this.customMetadataCache.get(filePath);
  }

  async compressFile(file: TFile) {
    try {
      const content = await this.app.vault.read(file);
      const compressed = gzip(content);
      const newPath = file.path.replace(/\.md$/, ".mdz");
      await this.app.vault.createBinary(newPath, compressed);

      const originalSize = new Blob([content]).size;
      const compressedSize = compressed.byteLength;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

      new Notice(
        `Compressed: ${file.name}\nOriginal: ${this.formatBytes(originalSize)}\nCompressed: ${this.formatBytes(compressedSize)}\nSaved: ${ratio}%`,
      );
    } catch (error) {
      new Notice(`Error compressing file: ${error.message}`);
      console.error(error);
    }
  }

  async bulkCompress() {
    const currentFolder = this.app.workspace.getActiveFile()?.parent;
    if (!currentFolder) {
      new Notice("No active file/folder");
      return;
    }

    const mdFiles = currentFolder.children.filter(
      (f) => f instanceof TFile && f.extension === "md",
    ) as TFile[];

    if (mdFiles.length === 0) {
      new Notice("No markdown files in current folder");
      return;
    }

    let count = 0;
    for (const file of mdFiles) {
      await this.compressFile(file);
      count++;
    }

    new Notice(`Compressed ${count} files`);
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  onunload() {
    console.log("Unloading Compressed Markdown Plugin");
    this.restoreGetFileCache();
    this.customMetadataCache.clear();
    this.hideCustomOutline();
  }
}

class CompressedMarkdownView extends MarkdownView {
  plugin: CompressedMarkdownPlugin;
  decompressedContent: string = "";

  constructor(leaf: WorkspaceLeaf, plugin: CompressedMarkdownPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_COMPRESSED_MD;
  }

  getDisplayText(): string {
    return this.file?.basename || "Compressed Markdown";
  }

  async onLoadFile(file: TFile): Promise<void> {
    try {
      const compressed = await this.app.vault.readBinary(file);
      const decompressed = inflate(new Uint8Array(compressed), {
        to: "string",
      });

      this.decompressedContent = decompressed;
      this.updateMetadataCache(file, decompressed);
      await this.setViewData(decompressed, false);
    } catch (error) {
      console.error("❌ Error in onLoadFile:", error);
      new Notice(`Error loading compressed file: ${error.message}`);
    }
  }

  async setViewData(data: string, clear: boolean): Promise<void> {
    await super.setViewData(data, clear);
  }

  getViewData(): string {
    return this.decompressedContent;
  }

  updateMetadataCache(file: TFile, content: string): void {
    try {
      const headings = this.parseHeadings(content);

      const cachedMetadata: CachedMetadata = {
        headings: headings,
        sections: [],
        links: [],
        embeds: [],
        tags: [],
        frontmatter: undefined,
        frontmatterPosition: undefined,
        frontmatterLinks: undefined,
      };

      this.plugin.setCustomMetadata(file.path, cachedMetadata);
    } catch (error) {
      console.error("Error updating metadata:", error);
    }
  }

  parseHeadings(content: string): HeadingCache[] {
    const headings: HeadingCache[] = [];
    const lines = content.split("\n");
    let currentOffset = 0;
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
      }

      if (inCodeBlock) {
        currentOffset += line.length + 1;
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const heading = headingMatch[2].trim();

        const position: Pos = {
          start: {
            line: i,
            col: 0,
            offset: currentOffset,
          },
          end: {
            line: i,
            col: line.length,
            offset: currentOffset + line.length,
          },
        };

        headings.push({
          heading: heading,
          level: level,
          position: position,
        });
      }

      currentOffset += line.length + 1;
    }

    return headings;
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.plugin.clearCustomMetadata(file.path);
    await super.onUnloadFile(file);
  }

  getIcon(): string {
    return "file-archive";
  }

  canAcceptExtension(extension: string): boolean {
    return extension === COMPRESSED_EXTENSION;
  }

  get canSave(): boolean {
    return false;
  }
}

/**
 * Tree node structure for hierarchical headings
 */
interface TreeNode {
  heading: HeadingCache;
  children: TreeNode[];
}

/**
 * Custom Outline View - Pixel-perfect replica of native Obsidian outline
 */
class CustomOutlineView extends ItemView {
  plugin: CompressedMarkdownPlugin;
  containerEl: HTMLElement;
  navHeaderEl: HTMLElement;
  viewContentEl: HTMLElement;
  treeRootEl: HTMLElement;

  // Feature states
  showSearch: boolean = false;
  followCursor: boolean = false;
  searchQuery: string = "";
  collapsedHeadings: Set<string> = new Set();
  activeHeadingLine: number = -1;

  constructor(leaf: WorkspaceLeaf, plugin: CompressedMarkdownPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_CUSTOM_OUTLINE;
  }

  getDisplayText(): string {
    const file = this.app.workspace.getActiveFile();
    return file ? `Outline of ${file.basename}` : ".mdz Outline";
  }

  getIcon(): string {
    return "list";
  }

  async onOpen(): Promise<void> {
    // IMPORTANT: Don't use this.contentEl directly!
    // We need to work with the leaf's content container
    const leafContentEl = this.containerEl.parentElement;

    if (!leafContentEl) {
      console.error("Could not find leaf content element");
      return;
    }

    // Clear and setup proper structure
    leafContentEl.empty();

    // Create three sibling elements under workspace-leaf-content
    this.navHeaderEl = leafContentEl.createEl("div", { cls: "nav-header" });
    const viewHeaderEl = leafContentEl.createEl("div", { cls: "view-header" });
    this.viewContentEl = leafContentEl.createEl("div", {
      cls: "view-content node-insert-event",
      attr: { style: "position: relative" },
    });

    // Build each section
    this.buildNavHeader();
    this.buildViewHeader(viewHeaderEl);
    this.treeRootEl = this.viewContentEl.createEl("div");

    this.updateOutline();
  }

  buildNavHeader(): void {
    const buttonsContainer = this.navHeaderEl.createEl("div", {
      cls: "nav-buttons-container",
    });

    // Search button
    const searchBtn = buttonsContainer.createEl("div", {
      cls: "clickable-icon nav-action-button",
      attr: { "aria-label": "Show search filter" },
    });
    setIcon(searchBtn, "search");
    searchBtn.addEventListener("click", () => this.toggleSearch());

    // Follow cursor button
    const followBtn = buttonsContainer.createEl("div", {
      cls: "clickable-icon nav-action-button",
      attr: { "aria-label": "Auto-scroll to current section" },
    });
    setIcon(followBtn, "gallery-vertical");
    followBtn.addEventListener("click", () => this.toggleFollowCursor());

    // Collapse all button
    const collapseBtn = buttonsContainer.createEl("div", {
      cls: "clickable-icon nav-action-button",
      attr: { "aria-label": "Collapse all" },
    });
    setIcon(collapseBtn, "chevrons-down-up");
    collapseBtn.addEventListener("click", () => this.collapseAll());

    // Search input container (hidden by default)
    const searchContainer = this.navHeaderEl.createEl("div", {
      cls: "search-input-container",
      attr: { style: "display: none" },
    });

    const searchInput = searchContainer.createEl("input", {
      type: "search",
      attr: {
        enterkeyhint: "search",
        spellcheck: "false",
        placeholder: "Search...",
      },
    });

    searchInput.addEventListener("input", (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this.updateOutline();
    });

    const clearBtn = searchContainer.createEl("div", {
      cls: "search-input-clear-button",
      attr: { "aria-label": "Clear search" },
    });

    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      this.searchQuery = "";
      this.updateOutline();
    });
  }

  buildViewHeader(viewHeaderEl: HTMLElement): void {
    // Left side (nav buttons)
    const leftSide = viewHeaderEl.createEl("div", { cls: "view-header-left" });
    const navButtons = leftSide.createEl("div", {
      cls: "view-header-nav-buttons",
    });

    const backBtn = navButtons.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-disabled": "true", "aria-label": "Navigate back" },
    });
    setIcon(backBtn, "arrow-left");

    const forwardBtn = navButtons.createEl("button", {
      cls: "clickable-icon",
      attr: { "aria-disabled": "true", "aria-label": "Navigate forward" },
    });
    setIcon(forwardBtn, "arrow-right");

    // Title container
    const titleContainer = viewHeaderEl.createEl("div", {
      cls: "view-header-title-container mod-at-start mod-fade mod-at-end",
    });

    const file = this.app.workspace.getActiveFile();
    if (file && file.parent) {
      const titleParent = titleContainer.createEl("div", {
        cls: "view-header-title-parent",
      });
      titleParent.createEl("span", {
        cls: "view-header-breadcrumb",
        text: file.parent.name,
        attr: { "aria-label": file.parent.name, draggable: "true" },
      });
      titleParent.createEl("span", {
        cls: "view-header-breadcrumb-separator",
        text: "/",
      });
    }

    titleContainer.createEl("div", {
      cls: "view-header-title",
      text: this.getDisplayText(),
    });

    // Actions (right side)
    const actions = viewHeaderEl.createEl("div", { cls: "view-actions" });

    const bookmarkBtn = actions.createEl("button", {
      cls: "clickable-icon view-action mod-bookmark",
      attr: { "aria-label": "Bookmark" },
    });
    setIcon(bookmarkBtn, "bookmark");

    const moreBtn = actions.createEl("button", {
      cls: "clickable-icon view-action",
      attr: { "aria-label": "More options" },
    });
    setIcon(moreBtn, "more-vertical");
  }

  toggleSearch(): void {
    this.showSearch = !this.showSearch;
    const searchContainer = this.navHeaderEl.querySelector(
      ".search-input-container",
    ) as HTMLElement;
    if (searchContainer) {
      searchContainer.style.display = this.showSearch ? "" : "none";
      if (this.showSearch) {
        const input = searchContainer.querySelector("input");
        input?.focus();
      }
    }
  }

  toggleFollowCursor(): void {
    this.followCursor = !this.followCursor;
    new Notice(`Auto-scroll: ${this.followCursor ? "ON" : "OFF"}`);
  }

  collapseAll(): void {
    const metadata = this.getCurrentMetadata();
    if (metadata?.headings) {
      // Collapse all except level 1
      metadata.headings.forEach((h) => {
        if (h.level > 1) {
          this.collapsedHeadings.add(this.getHeadingKey(h));
        }
      });
      this.updateOutline();
    }
  }

  getHeadingKey(heading: HeadingCache): string {
    return `${heading.level}-${heading.heading}`;
  }

  getCurrentMetadata(): CachedMetadata | undefined {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.extension !== COMPRESSED_EXTENSION) {
      return undefined;
    }
    return this.plugin.getCustomMetadata(activeFile.path);
  }

  updateOutline(): void {
    this.treeRootEl.empty();

    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile || activeFile.extension !== COMPRESSED_EXTENSION) {
      this.treeRootEl.createEl("div", {
        text: "Open a .mdz file to see outline",
        cls: "pane-empty",
      });
      return;
    }

    const metadata = this.getCurrentMetadata();

    if (!metadata || !metadata.headings || metadata.headings.length === 0) {
      this.treeRootEl.createEl("div", {
        text: "No headings found",
        cls: "pane-empty",
      });
      return;
    }

    // Filter by search query
    let headings = metadata.headings;
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      headings = headings.filter((h) =>
        h.heading.toLowerCase().includes(query),
      );
    }

    // Build tree structure
    this.buildHeadingTree(headings);
  }

  buildHeadingTree(headings: HeadingCache[]): void {
    if (headings.length === 0) return;

    // Create hierarchical structure
    const root: TreeNode[] = [];
    const stack: TreeNode[] = [];

    headings.forEach((heading) => {
      const node: TreeNode = { heading, children: [] };

      // Find parent
      while (
        stack.length > 0 &&
        stack[stack.length - 1].heading.level >= heading.level
      ) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    // Render tree
    root.forEach((node) => this.renderTreeNode(node, 0));
  }

  renderTreeNode(node: TreeNode, depth: number): void {
    const treeItem = this.treeRootEl.createEl("div", { cls: "tree-item" });

    const hasChildren = node.children.length > 0;
    const headingKey = this.getHeadingKey(node.heading);
    const isCollapsed = this.collapsedHeadings.has(headingKey);
    const isActive =
      node.heading.position.start.line === this.activeHeadingLine;

    // Calculate padding (17px per level)
    const paddingLeft = 24 + depth * 17;
    const marginLeft = depth > 0 ? -(depth * 17) : 0;

    // Tree item self
    const selfClasses = ["tree-item-self", "is-clickable"];
    if (hasChildren) selfClasses.push("mod-collapsible");
    if (isActive) selfClasses.push("is-active");

    const treeSelf = treeItem.createEl("div", {
      cls: selfClasses.join(" "),
      attr: {
        draggable: "true",
        style: `margin-inline-start: ${marginLeft}px !important; padding-inline-start: ${paddingLeft}px !important;`,
      },
    });

    // Collapse icon (if has children)
    if (hasChildren) {
      const collapseIcon = treeSelf.createEl("div", {
        cls: "tree-item-icon collapse-icon",
      });
      setIcon(collapseIcon, "right-triangle");

      if (isCollapsed) {
        collapseIcon.classList.add("is-collapsed");
      }

      collapseIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleCollapse(headingKey);
      });
    }

    // Heading text
    const treeInner = treeSelf.createEl("div", {
      cls: "tree-item-inner",
      text: node.heading.heading,
    });

    // Click to scroll
    treeSelf.addEventListener("click", () => {
      this.scrollToHeading(node.heading);
    });

    // Children container
    if (hasChildren) {
      const childrenContainer = treeItem.createEl("div", {
        cls: "tree-item-children",
        attr: { style: isCollapsed ? "min-height: 0px" : "" },
      });

      if (!isCollapsed) {
        node.children.forEach((child) => {
          const childEl = this.renderTreeNodeToElement(child, depth + 1);
          childrenContainer.appendChild(childEl);
        });
      }
    } else {
      treeItem.createEl("div", {
        cls: "tree-item-children",
        attr: { style: "min-height: 0px" },
      });
    }
  }

  renderTreeNodeToElement(node: TreeNode, depth: number): HTMLElement {
    const treeItem = document.createElement("div");
    treeItem.classList.add("tree-item");

    const hasChildren = node.children.length > 0;
    const headingKey = this.getHeadingKey(node.heading);
    const isCollapsed = this.collapsedHeadings.has(headingKey);

    const paddingLeft = 24 + depth * 17;
    const marginLeft = -(depth * 17);

    const selfClasses = ["tree-item-self", "is-clickable"];
    if (hasChildren) selfClasses.push("mod-collapsible");

    const treeSelf = treeItem.createEl("div", {
      cls: selfClasses.join(" "),
      attr: {
        draggable: "true",
        style: `margin-inline-start: ${marginLeft}px !important; padding-inline-start: ${paddingLeft}px !important;`,
      },
    });

    if (hasChildren) {
      const collapseIcon = treeSelf.createEl("div", {
        cls: "tree-item-icon collapse-icon",
      });
      setIcon(collapseIcon, "right-triangle");

      if (isCollapsed) {
        collapseIcon.classList.add("is-collapsed");
      }

      collapseIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleCollapse(headingKey);
      });
    }

    treeSelf.createEl("div", {
      cls: "tree-item-inner",
      text: node.heading.heading,
    });

    treeSelf.addEventListener("click", () => {
      this.scrollToHeading(node.heading);
    });

    if (hasChildren) {
      const childrenContainer = treeItem.createEl("div", {
        cls: "tree-item-children",
        attr: { style: isCollapsed ? "min-height: 0px" : "" },
      });

      if (!isCollapsed) {
        node.children.forEach((child) => {
          childrenContainer.appendChild(
            this.renderTreeNodeToElement(child, depth + 1),
          );
        });
      }
    } else {
      treeItem.createEl("div", {
        cls: "tree-item-children",
        attr: { style: "min-height: 0px" },
      });
    }

    return treeItem;
  }

  toggleCollapse(headingKey: string): void {
    if (this.collapsedHeadings.has(headingKey)) {
      this.collapsedHeadings.delete(headingKey);
    } else {
      this.collapsedHeadings.add(headingKey);
    }
    this.updateOutline();
  }

  scrollToHeading(heading: HeadingCache): void {
    // Get the active view (should be CompressedMarkdownView)
    const activeLeaf = this.app.workspace.activeLeaf;
    const activeView = activeLeaf?.view;

    if (!activeView || !heading.position) {
      return;
    }

    // Try to access editor (works for both MarkdownView and CompressedMarkdownView)
    const editor = (activeView as any).editor;

    if (editor && editor.setCursor && editor.scrollIntoView) {
      // Set cursor to heading line
      const pos = { line: heading.position.start.line, ch: 0 };
      editor.setCursor(pos);

      // Scroll into view
      editor.scrollIntoView(
        {
          from: pos,
          to: pos,
        },
        true, // center in view
      );

      // Update active state
      this.activeHeadingLine = heading.position.start.line;
      this.updateOutline();
    } else {
      // Fallback: try to scroll using DOM
      this.scrollToHeadingByDOM(heading);
    }
  }

  scrollToHeadingByDOM(heading: HeadingCache): void {
    // Fallback method using DOM manipulation
    const activeView = this.app.workspace.activeLeaf?.view;
    if (!activeView) return;

    // Get the view content element
    const contentEl = (activeView as any).contentEl as HTMLElement;
    if (!contentEl) return;

    // Find all headings in the content
    const headingElements = contentEl.querySelectorAll(
      "h1, h2, h3, h4, h5, h6",
    );

    // Try to find matching heading by text
    for (let i = 0; i < headingElements.length; i++) {
      const el = headingElements[i] as HTMLElement;
      if (el.textContent?.trim() === heading.heading) {
        // Scroll to element
        el.scrollIntoView({ behavior: "smooth", block: "start" });

        // Update active state
        this.activeHeadingLine = heading.position.start.line;
        this.updateOutline();
        break;
      }
    }
  }

  async onClose(): Promise<void> {
    const leafContentEl = this.containerEl.parentElement;
    if (leafContentEl) {
      leafContentEl.empty();
    }
  }
}
