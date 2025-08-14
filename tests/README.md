# Tests - Nova Journal Plugin

## Structure

```
tests/
├── setup.ts                    # Configuration globale des tests
├── services/
│   └── ai/
│       ├── EnhancedRAG.test.ts       # Tests du système RAG amélioré
│       ├── EmbeddingMigration.test.ts # Tests de migration
│       └── PromptGeneration.test.ts   # Tests de génération de prompts
└── README.md                   # Ce fichier
```

## Commandes

### Exécuter tous les tests
```bash
npm test
```

### Mode watch (redémarre automatiquement)
```bash
npm run test:watch
```

### Générer un rapport de couverture
```bash
npm run test:coverage
```

## Configuration

Les tests utilisent Jest avec TypeScript et les mocks suivants :

### Mocks globaux
- **Obsidian API** : Classes et fonctions principales simulées
- **localStorage** : Stockage local simulé pour les tests d'index
- **fetch** : Appels API simulés pour les services AI
- **console.error** : Filtré pour des logs plus propres

### Environnement de test
- **jsdom** : Simulation d'un environnement navigateur
- **ts-jest** : Compilation TypeScript à la volée
- **Couverture** : Collecte automatique des métriques de couverture

## Écrire des tests

### Structure recommandée
```typescript
describe('ServiceName', () => {
  let service: ServiceName;
  let mockDependency: MockType;

  beforeEach(() => {
    // Setup avant chaque test
    mockDependency = createMock();
    service = new ServiceName(mockDependency);
  });

  describe('methodName', () => {
    test('should do something when condition', async () => {
      // Arrange
      const input = 'test input';
      mockDependency.method.mockResolvedValue('expected');

      // Act
      const result = await service.methodName(input);

      // Assert
      expect(result).toBe('expected');
      expect(mockDependency.method).toHaveBeenCalledWith(input);
    });
  });
});
```

### Bonnes pratiques

1. **AAA Pattern** : Arrange, Act, Assert
2. **Descriptive names** : Tests lisibles comme des phrases
3. **Mock isolation** : Reset des mocks entre les tests
4. **Edge cases** : Tester les cas limites et erreurs
5. **Async handling** : Proper async/await usage

### Mocking des services AI

```typescript
// Mock d'un service d'embedding
const mockEmbeddingService = {
  contextualSearch: jest.fn().mockResolvedValue([]),
  emotionalSearch: jest.fn().mockResolvedValue([]),
  incrementalUpdateIndex: jest.fn().mockResolvedValue(undefined)
};

// Mock d'appels API
global.fetch = jest.fn().mockImplementation((...args) =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: (name: string) => null },
    json: async () => ({
      choices: [{ message: { content: 'AI response' } }]
    })
  })
);
// In individual tests or setup/teardown:
// (afterEach(() => { (global.fetch as jest.Mock).mockReset(); }))
```

## Couverture de code

### Objectifs
- **Statements** : > 80%
- **Branches** : > 75%
- **Functions** : > 85%
- **Lines** : > 80%

### Zones critiques
- Services AI (génération, embedding, migration)
- Gestion d'erreurs et fallbacks
- Logique de classification contextuelle
- Algorithmes de scoring et diversité

### Exclusions
- Fichiers de test (.test.ts)
- Définitions TypeScript (.d.ts)
- Mocks et setup files

## Tests spécifiques

### EnhancedRAG.test.ts
- Classification des types de contexte
- Extraction de tags émotionnels/thématiques/temporels
- Filtres de diversité et scoring
- Recherches contextuelles

### EmbeddingMigration.test.ts
- Détection de migration nécessaire
- Processus de migration complet
- Gestion des erreurs de migration
- Nettoyage des index legacy

### PromptGeneration.test.ts
- Sélection intelligente du type de prompt
- Fallback vers système legacy
- Intégration avec services enhanced
- Gestion des configurations AI

## Debugging

### Logs de test
```bash
# Verbose output
npm test -- --verbose

# Specific test file
npm test -- tests/services/ai/EnhancedRAG.test.ts

# With coverage details
npm test -- --coverage --coverageReporters=text-lcov
```

### VSCode Integration
Ajoutez cette configuration dans `.vscode/settings.json` :
```json
{
  "jest.jestCommandLine": "npm test --",
  "jest.autoRun": "watch"
}
```

## CI/CD

Les tests sont intégrés dans le workflow de développement :

1. **Pre-commit** : Tests de smoke automatiques
2. **Pull Request** : Suite complète de tests
3. **Release** : Tests + couverture + validation

### GitHub Actions
```yaml
- name: Run tests
  run: npm test -- --coverage --passWithNoTests
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

---

Cette structure de tests garantit la qualité et la fiabilité du système RAG amélioré tout en facilitant le développement et la maintenance.
