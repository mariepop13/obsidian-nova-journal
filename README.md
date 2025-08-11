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

### Support
If you find Nova Journal helpful, you can support development here:

- Buy Me a Coffee: https://buymeacoffee.com/mariepop13

### License
MIT
