# Socratix — Référentiel Pédagogique Java POO (FSG - M. Mohamed Belhassen)

Ce document constitue la base de connaissances officielle de l'agent Socratix. Lors de l'explication d'un concept à un étudiant, Socratix DOIT impérativement citer le chapitre, le numéro exact de la slide, et l'analogie du cours correspondante.

---

## PARTIE 1 : MAPPING DU COURS MAGISTRAL (CHAPITRES 1 À 6 & NUMÉROS DE SLIDES EXACTS)

### Chapitre 1 : Introduction à Java (`CH1_INTRO`)
- **Exécution et Bytecode (Slide 9) :** Processus de compilation du code source (`.java`) via `javac` en pseudo-code / Bytecode (`.class`) exécuté par la Machine Virtuelle Java (JVM - `java`).
- **Structure de base d'un programme (Slides 11-12) :** Exemple du premier programme `"Bonjour le monde"` et signature exacte du point d'entrée `public static void main(String args[])`.

### Chapitre 2 : Éléments de base de Java (`CH2_BASES`)
- **Conventions de nommage et Constantes (Slides 5-6) :**
  - Classes en `PascalCase` (ex: `MammifereMarin`), méthodes et variables en `camelCase` (ex: `obtenirAge`).
  - Constantes en majuscules verrouillées avec le mot-clé `final` (ex: `final float PI = 3.14;`, `MAX_HEIGHT`).
- **Types de données primitifs (Slides 14-18) :** Affectation mémoire et plages de valeurs des types primitifs (`int`, `double`, `float`, `char`, `boolean`, `byte`, `short`, `long`).
- **Tableaux (Slides 19-20) :** Déclaration, allocation dynamique de mémoire avec `new` (ex: `new int[20]`), initialisation et accès indicé (`grades[0]`), tableaux multidimensionnels (`double[][]`), prévention du débordement d'indice (`ArrayIndexOutOfBoundsException`).
- **Manipulation de texte : `String` vs `StringBuffer` (Slides 21-22) :**
  - `String` est **immuable** (toute modification pointe vers un nouvel emplacement mémoire).
  - `StringBuffer` est **mutable** (permet de modifier la chaîne sur place, ex: avec `setCharAt` ou `append`).
- **Transtypage / Cast (Slides 23-24) :** Conversion implicite vs conversion explicite (ex: `(float) retourInt()` ou `(double) 15 / 2`) pour éviter la perte de précision lors d'une division entière.
- **Portée des variables (Slides 25-26) :** Visibilité des variables locales limitée strictement au bloc `{ ... }` dans lequel elles sont déclarées, par opposition aux attributs de classe.
- **Structures de contrôle (Slides 27-34) :**
  - Boucles : `while`, `do..while`, `for`.
  - Instructions de rupture de flux : `break` et `continue`.
  - Branchements conditionnels : `if-else` et `switch` avec `case` et `default` (Slide 34).

### Chapitre 3 : Les Classes, Objets et Encapsulation (`CH3_CLASSES`)
- **Classe vs Objet (Slides 28-32) :**
  - Analogie centrale du **`Four`** (attributs : `puissance`, `capacite` ; méthode : `cuire(Aliment)`).
  - La classe est le modèle/description ; l'objet est l'instance concrète en mémoire créée avec `new` (`petitFour`, `grandFour`), gestion des références et de `null` (`NullPointerException`).
- **Visibilité et Encapsulation (Slides 38-43) :**
  - Protection des composants internes avec `private` (ex: `private Resistance resistance;` et `private Soufflerie soufflerie;` dans la classe `Four`, Slide 42).
  - Danger d'un attribut non protégé : un utilisateur externe pourrait écrire directement `four.resistance = null;` et détruire l'intégrité de l'objet (Slide 42).
  - Accès contrôlé via **Getters** (lecture) et **Setters** (écriture avec règles de validation).
- **Constructeurs et Autoréférence `this` (Slides 15, 23-24) :**
  - Constructeur : même nom que la classe, **aucun type de retour** (même pas `void`).
  - Mot-clé `this` pour lever l'ambiguïté entre attributs et paramètres (`this.jour = jour;`) et chaînage de constructeurs avec `this(...)` en première instruction.
- **Membres Statiques `static` et `final` (Slides 9, 13-14) :**
  - Attributs et méthodes de classe partagés par toutes les instances : exemple du compteur d'instances `static int count` dans **`ClasseChien`** et de la classe utilitaire **`MathTool`** (`public static final double PI`).

### Chapitre 4 : L'Héritage, le Polymorphisme et l'Abstraction (`CH4_INHERITANCE`)
- **Hiérarchie et Polymorphisme (Slides 5-8) :**
  - Exemple fil conducteur de la classe mère **`Felin`** et de ses sous-classes **`Tigre`** et **`Chat`** (`extends`).
  - Redéfinition (`@Override`) de la méthode `parler()` (`"Groar!"`, `"Miaou!"`) et appel polymorphe via un tableau `Felin[]` dans la classe **`Zoo`** (Slide 8).
- **Mot-clé `super` (Slide 10) :**
  - Appel obligatoire au constructeur parent via `super(...)` en **première ligne** du constructeur enfant.
  - Réutilisation du comportement de la classe mère via `super.methode()` (ex: `super.print()`).
- **Classes et Méthodes Abstraites (Slides 11-12) :**
  - Déclaration `abstract class Felin` et méthode sans corps `abstract void parler();`.
  - Interdiction formelle d'instancier directement une classe abstraite (`new Felin()` est interdit). Obligation pour les sous-classes concrètes de redéfinir toutes les méthodes abstraites.
- **Classe cosmique `Object`, `instanceof` et Downcasting (Slide 13) :**
  - Vérification dynamique du type réel avec `instanceof` avant d'effectuer un transtypage descendant (*downcasting*), ex: `if (t instanceof Tigre) { ((Tigre) t).parler(); }`, pour éviter `ClassCastException`.

### Chapitre 5 : Les Interfaces (`CH5_INTERFACES`)
- **Le Contrat et l'Implémentation (Slides 15-24) :**
  - Exemple de référence : l'interface **`Downloadable`** implémentée (`implements`) par des classes sans lien d'héritage comme **`Document`** et **`Program`**.
  - Polymorphisme d'interface (Slide 18) : la classe **`DownloadManager`** manipule de façon homogène un tableau `Downloadable[]`.
- **Héritage multiple d'interfaces (Slides 25-30) :** Une interface peut étendre plusieurs interfaces avec `extends` (ex: `Omnivore extends Carnivore, Herbivore`).
- **Interfaces Marqueurs et Clonage (Slides 44-45) :** L'interface vide **`Cloneable`** autorisant la copie d'objet via `super.clone()` (exemple `TestClone`).
- **Évolution d'Interfaces : `default` et `static` (Slides 50-51) :** Ajout de méthodes avec implémentation par défaut `default` (ex: `transferer` dans l'interface **`Compte`**) et de méthodes `static` (`getBalanceTotale`).

### Chapitre 6 : Programmation Défensive et Exceptions (`CH6_EXCEPTIONS`)
- **Blocs `try / catch / finally` et erreurs arithmétiques (Slides 10-12, 18) :**
  - Exemple de la division par zéro (`ArithmeticException`) dans la classe **`CalculMath`**.
  - Ordre des blocs `catch` (de la sous-classe la plus spécifique vers la plus générale), utilisation de `getMessage()` et `printStackTrace()`, bloc `finally` exécuté systématiquement.
- **Propagation (`throw` / `throws`) et Exceptions Personnalisées (Slides 26-28) :**
  - Distinction entre exceptions contrôlées (`Exception`) et non contrôlées (`RuntimeException`).
  - Création d'une exception métier personnalisée héritant de `Exception` : exemple de **`SaisieErroneeException`** (Slide 26) avec appel à `super(message)`, déclenchement avec `throw new SaisieErroneeException(...)` et déclaration `throws` dans la signature de la méthode.

---

## PARTIE 2 : MAPPING DES 12 TP (ACTIVITÉS DU COURS & PROJET FIL ROUGE "YALLA POS CONSOLE")

### TP 1 : Introduction à Java, Typage et Transtypage
- **Activité 1 (`Calculatrice.java`) :** Division entière `15 / 2` (perte de précision donnant `7`) vs transtypage explicite `(double) 15 / 2` (donnant `7.5`), constante `final double PI = 3.14159`.
- **Activité 2 (`YallaPOS.java`) :** Impression d'un ticket de caisse statique en dur (nom article, prix HT, quantité, TVA 19%, calcul du TTC, formatage `\n` et `\t`).
- **Micro-compétences cibles :** `SYNTAX_CONVENTIONS`, `TYPING_CASTING`, `STATIC_MEMBERS`.

### TP 2 : Structures de Contrôle et Lecture Interactive (`Scanner`)
- **Activité 1 (`Distributeur.java`) :** Distributeur de boissons interactif avec boucle `do...while` et `switch / case / default`.
- **Activité 2 (`YallaPOS.java`) :** Saisie dynamique des prix avec `Scanner`, arrêt de la boucle avec `break` si `prix <= 0`, et remise de 10 % (`if`) lorsque `totalHT > 200` TND.
- **Micro-compétences cibles :** `SCOPE_CONTROL_FLOW`.

### TP 3 : Tableaux et Chaînes de Caractères (`StringBuffer`)
- **Activité 1 (`GestionNotes.java`) :** Tableau 2D `double[][]` des notes d'étudiants et génération d'un bilan dynamique avec `StringBuffer`.
- **Activité 2 (`YallaPOS.java`) :** Mémorisation du ticket via deux tableaux parallèles `String[] nomsArticles` et `double[] prixArticles` bornés par `final int MAX_ARTICLES = 10` et un compteur d'articles.
- **Micro-compétences cibles :** `ARRAYS_STRINGS`, `SCOPE_CONTROL_FLOW`.

### TP 4 : Passage à la POO — Classes, Objets et Constructeurs
- **Activité 1 (`Four.java`, `Aliment.java`) :** Création d'objets indépendants et interaction via passage d'objet en paramètre `four.cuire(aliment)`.
- **Activité 2 (`Article.java`, `YallaPOS.java`) :** Création de la classe métier `Article` (`designation`, `prixHT`, `codeBarre`, constructeur avec `this`, méthode `afficherDetails()`). Remplacement des tableaux parallèles par un tableau d'objets `Article[] panier`.
- **Micro-compétences cibles :** `INSTANTIATION_REFERENCES`, `CONSTRUCTORS_THIS`.

### TP 5 : Encapsulation, Validation et Surcharge (`this(...)`)
- **Activité 1 (`Four.java`, `Resistance.java`, `Soufflerie.java`) :** Passage des composants internes du `Four` en `private`, création des Getters et validation dans `setSoufflerie` (vérification non `null`).
- **Activité 2 (`Article.java`) :** Encapsulation stricte des attributs de `Article` en `private`, règle métier dans `setPrixHT(double nouveauPrix)` refusant les prix négatifs (`< 0`), et surcharge du constructeur appelant `this(designation, prixHT, "000000")` pour les articles sans code-barres.
- **Micro-compétences cibles :** `VISIBILITY_ENCAPSULATION`, `CONSTRUCTORS_THIS`, `METHOD_OVERLOADING`.

### TP 6 : Membres de Classe (`static`) et Constantes Partagées
- **Activité 1 (`ClasseChien.java`, `MathTool.java`) :** Compteur statique d'instances `count` et méthodes utilitaires statiques.
- **Activité 2 (`Article.java`, `YallaPOS.java`) :** Constante globale `public static final double TAUX_TVA = 0.19` (accédée via `Article.TAUX_TVA`) et compteur `private static int nombreArticlesCrees` incrémenté dans le constructeur.
- **Micro-compétences cibles :** `STATIC_MEMBERS`.

### TP 7 : Héritage (`extends`), Chaînage `super(...)` et Redéfinition
- **Activité 1 (`Felin.java`, `Tigre.java`, `Chat.java`) :** Hiérarchie d'héritage et redéfinition.
- **Activité 2 (`ArticlePerissable.java`, `ArticleElectronique.java`) :** Spécialisation de `Article` avec `extends`. Appel obligatoire à `super(designation, prixHT, codeBarre)` en 1re ligne du constructeur, et redéfinition `@Override` de `afficherDetails()` réutilisant `super.afficherDetails()`. Stockage polymorphe dans `Article[] panier`.
- **Micro-compétences cibles :** `INHERITANCE_EXTENDS`, `SUPER_KEYWORD`, `POLYMORPHIC_ARRAY`.

### TP 8 : Abstraction (`abstract`), Polymorphisme et Downcasting (`instanceof`)
- **Activité 1 (`Felin.java`, `Zoo.java`) :** `Felin` devient `abstract` avec `abstract void parler();`.
- **Activité 2 (`Article.java`, `YallaPOS.java`) :** `Article` devient `abstract class Article` (interdiction de `new Article(...)`) avec une méthode abstraite métier (ex: `calculerPrixTTC()` ou `estGarantieValide()`). Dans la boucle du panier, détection des articles périssables avec `instanceof ArticlePerissable` suivie d'un downcasting explicite `((ArticlePerissable) panier[i])`.
- **Micro-compétences cibles :** `ABSTRACT_CLASSES_METHODS`, `POLYMORPHIC_ARRAY`, `TYPING_CASTING`.

### TP 9 : Interfaces (`implements`) et Panier Polymorphe (`Facturable[]`)
- **Activité 1 (`Downloadable.java`, `Document.java`, `Program.java`, `DownloadManager.java`) :** Contrat d'interface et manipulation polymorphe.
- **Activité 2 (`Facturable.java`, `Service.java`, `Article.java`, `YallaPOS.java`) :** Création de l'interface `Facturable` (`double getMontantTTC()`, `String getDesignation()`). `Article implements Facturable` et nouvelle classe indépendante `Service implements Facturable` (qui n'hérite PAS de `Article`). Migration du panier dans `YallaPOS` de `Article[]` vers `Facturable[] panier`.
- **Micro-compétences cibles :** `INTERFACE_CONTRACT`, `INTERFACE_POLYMORPHISM`.

### TP 10 : Interfaces Avancées (`default`, `static`) et Interface Marqueur (`Cloneable`)
- **Activité 1 (`Compte.java`) :** Méthodes `default` (`transferer`) et `static` dans une interface.
- **Activité 2 (`Remisable.java`, `Service.java`) :** Interface avec méthode `default` de calcul de remise et implémentation de l'interface marqueur `Cloneable` (redéfinition de `clone()` avec `super.clone()`) pour dupliquer rapidement un service ou article type dans le panier.
- **Micro-compétences cibles :** `DEFAULT_STATIC_MARKER_INTERFACES`, `INTERFACE_CONTRACT`.

### TP 11 : Programmation Défensive et Robustesse du `Scanner` (`try / catch / finally`)
- **Activité 1 (`CalculMath.java`) :** Capture de `ArithmeticException` (division par zéro), affichage de `e.getMessage()` et bloc `finally`.
- **Activité 2 (`YallaPOS.java`) :** Sécurisation de la saisie utilisateur au clavier (`Scanner`) contre `InputMismatchException` avec un bloc `try / catch`, vidage du buffer (`scanner.nextLine()`) et reprise de la boucle avec `continue` sans crasher la caisse.
- **Micro-compétences cibles :** `TRY_CATCH_FINALLY`, `THROW_THROWS_PROPAGATION`.

### TP 12 : Exceptions Personnalisées Contrôlées (`PaiementInvalideException`)
- **Activité 1 (`SaisieErroneeException.java`) :** Création d'une exception contrôlée `extends Exception` avec `super(message)`.
- **Activité 2 (`PaiementInvalideException.java`, `YallaPOS.java`) :** Création de `PaiementInvalideException extends Exception`. Méthode `validerPaiement(double montantDonne, double totalTTC) throws PaiementInvalideException` qui déclenche `throw new PaiementInvalideException(...)` si `montantDonne < totalTTC` ou négatif. Encapsulation de l'encaissement dans `main` avec une boucle de ressaisie `try / catch`.
- **Micro-compétences cibles :** `CUSTOM_CHECKED_EXCEPTIONS`, `THROW_THROWS_PROPAGATION`, `TRY_CATCH_FINALLY`.
