// ============================================================================
// SOCRATIX - GOLDEN FEW-SHOT META-PROMPT EXEMPLARS
// ============================================================================
// Proven exemplars extracted from knowledge_base.md and app/api/tutor/route.ts
// Used by Course Studio API routes to guide muse-spark-1.3 during PDF analysis
// and course compilation for any current or future curriculum.
// ============================================================================

/**
 * Exemplar 1: Chapter Synthesis (Slide Anchoring + Code Identifiers + Anti-Patterns)
 * Extracted from Chapter 3 & Chapter 5 of knowledge_base.md
 */
export const GOLDEN_CHAPTER_SYNTHESIS_SHOT = `### Chapitre 3 : Les Classes, Objets et Encapsulation (CH3_CLASSES)
- **Classe vs Objet (Slides 28-32) :**
  - Analogie centrale du **\`Four\`** (attributs : \`puissance\`, \`capacite\` ; méthode : \`cuire(Aliment)\`).
  - La classe est le modèle/description ; l'objet est l'instance concrète en mémoire créée avec \`new\` (\`petitFour\`, \`grandFour\`), gestion des références et de \`null\` (\`NullPointerException\`).
- **Visibilité et Encapsulation (Slides 38-43) :**
  - Protection des composants internes avec \`private\` (ex: \`private Resistance resistance;\` et \`private Soufflerie soufflerie;\` dans la classe \`Four\`, Slide 42).
  - Danger d'un attribut non protégé : un utilisateur externe pourrait écrire directement \`four.resistance = null;\` et détruire l'intégrité de l'objet (Slide 42).
  - Accès contrôlé via **Getters** (lecture) et **Setters** (écriture avec règles de validation).
- **Constructeurs et Autoréférence \`this\` (Slides 15, 23-24) :**
  - Constructeur : même nom que la classe, **aucun type de retour** (même pas \`void\`).
  - Mot-clé \`this\` pour lever l'ambiguïté entre attributs et paramètres (\`this.jour = jour;\`) et chaînage de constructeurs avec \`this(...)\` en première instruction.
- **Membres Statiques \`static\` et \`final\` (Slides 9, 13-14) :**
  - Attributs et méthodes de classe partagés par toutes les instances : exemple du compteur d'instances \`static int count\` dans **\`ClasseChien\`** et de la classe utilitaire **\`MathTool\`** (\`public static final double PI\`).`;

/**
 * Exemplar 2: Global Competency Taxonomy
 * Shows the model the ideal SCREAMING_SNAKE_CASE naming and 2-4 granular concepts per chapter
 */
export const GOLDEN_COMPETENCY_TAXONOMY_SHOT = [
  {
    chapter_code: 'CH3_CLASSES',
    competency_title: 'Object Modeling & Encapsulation',
    micro_competencies: [
      {
        code: 'VISIBILITY_ENCAPSULATION',
        title: 'Private Attributes & Controlled Access',
        slide_ref: 'Ch.3 Slide 42',
        description: 'Marking attributes private and exposing getters to prevent external corruption.',
      },
      {
        code: 'DEFENSIVE_SETTERS',
        title: 'Setter Validation & Invariants',
        slide_ref: 'Ch.3 Slide 43',
        description: 'Enforcing business rules (e.g. price > 0, non-null) inside setter methods.',
      },
      {
        code: 'CONSTRUCTORS_THIS',
        title: 'Constructors & this Reference',
        slide_ref: 'Ch.3 Slides 15, 23-24',
        description: 'Parameterized constructors, initializing state, and disambiguating fields with this.',
      },
      {
        code: 'STATIC_MEMBERS',
        title: 'Static Class Members & Constants',
        slide_ref: 'Ch.3 Slides 9, 13-14',
        description: 'Shared instance counters and public static final utility constants.',
      },
    ],
  },
  {
    chapter_code: 'CH5_INTERFACES',
    competency_title: 'Interface Contracts & Polymorphism',
    micro_competencies: [
      {
        code: 'INTERFACE_CONTRACT',
        title: 'Interface Declaration & Implementation',
        slide_ref: 'Ch.5 Slides 15-18',
        description: 'Declaring method contracts and implementing them across unrelated classes.',
      },
      {
        code: 'INTERFACE_POLYMORPHISM',
        title: 'Polymorphic Interface Arrays',
        slide_ref: 'Ch.5 Slide 18',
        description: 'Manipulating collections of heterogeneous objects via a shared interface type.',
      },
    ],
  },
];

/**
 * Exemplar 3: Custom Tutor System Prompt (Anchoring + Few-Shots)
 * Model learns how to generate the custom prompt section for new courses
 */
export const GOLDEN_TUTOR_PROMPT_SHOT = `### PEDAGOGICAL ANCHORING (MANDATORY)
To illustrate your explanation, you must use the exact analogies from the course AND cite the corresponding slide number:
* For encapsulation issues (missing private modifiers): Remind them of the "Oven" (Four) example on Slide 42 of Chapter 3, and the danger of letting an external user directly modify \`four.resistance = null;\`.
* For static members issues: Reference the \`count\` variable shared by all \`ClasseChien\` objects, or the \`MathTool.PI\` utility (Chapter 3, Slides 9, 13-14).
* For inheritance/polymorphism issues: Draw a parallel with the abstract parent class \`Felin\` and its subclasses \`Tigre\` or \`Chat\`, and how the \`Zoo\` class calls \`parler()\` polymorphically (Slide 8, Chapter 4).
* For interface issues: Refer to the \`Downloadable\` interface grouping \`Document\` and \`Program\` in \`DownloadManager\` (Slide 15-18, Chapter 5).

### REASONING EXAMPLES (FEW-SHOT PROMPTING)

--- EXAMPLE 1: IN PROGRESS (SOCRATIC GUIDANCE WITH ANALOGY) ---
Student Code: \`public class Item { double price; ... }\`
Assistant Message: "I see you've created the \`Item\` class, which is a great start! However, look at line 2: your \`price\` attribute lacks a visibility modifier.\\n\\nDo you remember the \`Oven\` (Four) example from Slide 42 in Chapter 3? What would happen if anyone could write \`myOven.resistance = null;\` from outside the class?\\n\\nHow could you protect your item's price to prevent a malicious cashier from modifying it directly?"
Course Reference: Chapter 3 (Slide 42): Encapsulation and Visibility

--- EXAMPLE 2: MILESTONE COMPLETED (CELEBRATION VERDICT) ---
Student Code: Clean Item.java with private fields, validated setters, getters, and valid tests.
Assistant Message: "🎉 **Outstanding work! You have successfully mastered Encapsulation.**\\n\\nYour \`Item\` class is now properly guarded: both \`name\` and \`price\` are strictly marked \`private\`, your constructor ensures proper initialization, and your setter enforces validation guarding against negative prices.\\n\\nYou have completed this milestone without shortcuts!"
Course Reference: Chapter 3 (Slides 38-43): Encapsulation and Access Modifiers`;

/**
 * Exemplar 4: Lab Decomposition (Activities + Milestones + Presets)
 * Model learns how to decompose a lab PDF into 2 activities, sequential milestones, and presets
 */
export const GOLDEN_LAB_DECOMPOSITION_SHOT = {
  activities: [
    {
      id: 'act_1',
      order: 1,
      title: 'Activité 1 : Encapsulation de la classe Item',
      instructions_markdown: 'Passez les attributs de la classe `Item` en `private`, ajoutez un getter pour chaque attribut et un setter défensif `setPrice(double)` rejetant les prix négatifs ou nuls.',
      target_files: ['Item.java', 'YallaPOS.java'],
      milestones: [
        {
          id: 'm1_1',
          order: 1,
          title: 'Protection des attributs avec private',
          validation_criteria: 'Les champs price et name doivent être explicitement déclarés avec le modificateur private.',
        },
        {
          id: 'm1_2',
          order: 2,
          title: 'Accesseurs et garde de validation du setter',
          validation_criteria: 'setPrice valide que price > 0 avant affectation et getPrice retourne la valeur courante.',
        },
      ],
    },
    {
      id: 'act_2',
      order: 2,
      title: 'Activité 2 : Validation des remises dans le Panier (Order)',
      instructions_markdown: 'Créez la classe `Order` avec une méthode `applyDiscount(double percent)` limitant la remise à un maximum de 50%.',
      target_files: ['Order.java', 'YallaPOS.java'],
      milestones: [
        {
          id: 'm2_1',
          order: 1,
          title: 'Plafond de remise défensif',
          validation_criteria: 'La méthode applyDiscount refuse toute remise négative ou supérieure à 50% sans modifier le total.',
        },
      ],
    },
  ],
  covered_micro_concepts: ['VISIBILITY_ENCAPSULATION', 'DEFENSIVE_SETTERS', 'CONSTRUCTORS_THIS'],
  demo_presets: [
    {
      key: 'act_1_buggy',
      activity_id: 'act_1',
      preset_type: 'buggy',
      label: '1. Buggy Encapsulation (Public Fields)',
      description: 'Item price has no visibility modifier and is corrupted directly.',
      files: [
        {
          name: 'Item.java',
          content: 'public class Item {\n  double price;\n  String name;\n\n  public Item(String name, double price) {\n    this.name = name;\n    this.price = price;\n  }\n}',
        },
        {
          name: 'YallaPOS.java',
          content: 'public class YallaPOS {\n  public static void main(String[] args) {\n    Item item = new Item("Coffee", 4.5);\n    item.price = -100.0;\n  }\n}',
        },
      ],
    },
    {
      key: 'act_1_solution',
      activity_id: 'act_1',
      preset_type: 'solution',
      label: '2. Validated Solution (Item Encapsulation)',
      description: 'Clean encapsulation with private attributes and guarded setter.',
      files: [
        {
          name: 'Item.java',
          content: 'public class Item {\n  private double price;\n  private String name;\n\n  public Item(String name, double price) {\n    this.name = name;\n    this.setPrice(price);\n  }\n\n  public double getPrice() { return this.price; }\n  public void setPrice(double price) {\n    if (price <= 0) return;\n    this.price = price;\n  }\n  public String getName() { return this.name; }\n}',
        },
        {
          name: 'YallaPOS.java',
          content: 'public class YallaPOS {\n  public static void main(String[] args) {\n    Item item = new Item("Coffee", 4.5);\n    item.setPrice(-100.0);\n    System.out.println(item.getPrice());\n  }\n}',
        },
      ],
    },
    {
      key: 'act_2_buggy',
      activity_id: 'act_2',
      preset_type: 'buggy',
      label: '1. Buggy Order (Uncapped Discount)',
      description: 'Order discount does not validate ceiling and accepts negative or invalid rates.',
      files: [
        {
          name: 'Order.java',
          content: 'public class Order {\n  double total = 100.0;\n  public void applyDiscount(double percent) {\n    this.total = this.total * (1 - percent / 100.0);\n  }\n}',
        },
        {
          name: 'YallaPOS.java',
          content: 'public class YallaPOS {\n  public static void main(String[] args) {\n    Order order = new Order();\n    order.applyDiscount(90.0);\n  }\n}',
        },
      ],
    },
    {
      key: 'act_2_solution',
      activity_id: 'act_2',
      preset_type: 'solution',
      label: '2. Validated Solution (Order Discount)',
      description: 'Defensive discount method strictly capping discount to 50% max.',
      files: [
        {
          name: 'Order.java',
          content: 'public class Order {\n  double total = 100.0;\n  public void applyDiscount(double percent) {\n    if (percent < 0 || percent > 50) return;\n    this.total = this.total * (1 - percent / 100.0);\n  }\n  public double getTotal() { return this.total; }\n}',
        },
        {
          name: 'YallaPOS.java',
          content: 'public class YallaPOS {\n  public static void main(String[] args) {\n    Order order = new Order();\n    order.applyDiscount(50.0);\n    System.out.println(order.getTotal());\n  }\n}',
        },
      ],
    },
  ],
};
