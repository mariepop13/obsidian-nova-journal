## 📊 Description
- [Clear bullet point of what this PR accomplishes]
- [Additional changes if any]
- [Configuration or setup changes]

## 🔗 Related Issues
[Link to issues or write "None"]

## 🚨 Breaking Changes
[List any breaking changes or write "None"]

___

## 📈 Diagram Walkthrough *(Skip if not applicable)*

```mermaid
flowchart TB
  subgraph "PR Workflow Automation"
    A["PR Created/Updated"] 
    B["claude-pr-automation.yml Triggered"]
    C["claude-code-review.yml Triggered"]
  end
  
  subgraph "Automation Process"
    D["Analyze PR Changes"]
    E["Apply Relevant Labels"]
    F["Update PR Description"]
    G["Run Code Review"]
  end
  
  subgraph "Action Components"
    H["claude-code-action@v1"]
    I["GitHub API Integration"]
    J["MCP GitHub Server"]
  end
  
  A --> B
  A --> C
  B --> D
  D --> E
  E --> F
  C --> G
  
  B --> H
  C --> H
  H --> I
  I --> J
  J --> E
  J --> F
  J --> G
```

*Replace with relevant architecture/flow diagram for your changes*

## 🧪 Review & Testing
**Checklist:**
- [ ] [Quick checklist item to verify]
- [ ] [Another verification point]

**Test steps:**
1. [Specific action to test the changes]
2. [Validate edge cases]

___

<details>
<summary><h2>📁 Files Changed</h2></summary>

<table>
<thead><tr><th>Category</th><th>Files</th></tr></thead>
<tbody>
<tr><td><strong>[Category name]</strong></td>
<td>
<details>
<summary><strong>[filename]</strong> - [brief description]</summary>
<hr>

[File path]

<ul>
<li>[What was changed]</li>
<li>[Why it was changed]</li>
<li>[Impact of the change]</li>
</ul>

</details>
</td></tr>
</tbody>
</table>

</details>
