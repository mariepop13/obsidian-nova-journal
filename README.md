## Nova Journal

Stellar journaling prompts and insights for Obsidian. Local-first by default, with optional AI features powered by external APIs (opt-in).

### Quickstart
1) Requirements: Obsidian 0.15+ and Node 16+
2) Install dependencies:
```bash
npm install
```
3) Dev build (watch):
```bash
npm run dev
```
4) Link to your vault:
```bash
# Remplacez /path/to/obsidian-nova-journal par le chemin de votre repo local
ln -s /path/to/obsidian-nova-journal /path/to/YourVault/.obsidian/plugins/nova-journal
```
5) Dans Obsidian: Settings → Community plugins → Enable “Nova Journal”

### Installation
- In Obsidian: Settings → Community plugins → Browse
- Search "Nova Journal" → Install → Enable
- Requires Obsidian 0.15.0+

### Development
- Build production:
```bash
npm run build
```
- Code style: TypeScript, small functions, meaningful names, early returns
- Prefer local logic; AI integrations use external APIs only when enabled by the user

### Privacy & Security
- No telemetry
- External API calls only when you enable AI features; keys are stored locally via Obsidian settings

### Roadmap

#### Priority 1 - Critical
- [ ] **Semantic Chunking** - Respect sentence boundaries for better context
- [ ] **Context Quality Assessment** - Validate relevance before using context
- [ ] **Type Safety** - Fix `any[]` types in RagContextService

#### Priority 2 - High Impact  
- [ ] **Multi-dimensional Scoring** - Semantic + emotional + temporal relevance
- [ ] **Result Caching** - TTL cache for repeated queries
- [ ] **Async Processing** - Prevent UI blocking during file processing

#### Priority 3 - Performance
- [ ] **ANN Search** - Hierarchical clustering for faster search
- [ ] **Multi-Modal Search** - Combine different search strategies
- [ ] **Personalized Ranking** - Learn from user interactions

### Support
If you find Nova Journal helpful, you can support development here:

- Buy Me a Coffee: https://buymeacoffee.com/mariepop13

### License
MIT
