# Supabase Authentication & Dual-Layer Profile Synchronization

> **Dossier :** `supabase/`  
> **Statut :** Déployé & Opérationnel en Production  
> **Composants Clés :** Trigger PostgreSQL `on_auth_user_created`, Route API `/api/auth/sync-profile`, Écouteur de Hash `/components/AuthHashListener.tsx`, Callback `/auth/callback`.

---

## 1. Contexte & Problématique Résolue

Dans l'écosystème Supabase, l'authentification est gérée dans un schéma interne isolé (`auth.users`), tandis que les données métier applicatives résident dans le schéma public (`public.profiles`).

### Les deux problèmes identifiés initialement :
1. **Absence de profil après inscription :**  
   Lorsqu'un utilisateur (ex: enseignant `abou.aziz.belhassen@gmail.com`) s'inscrivait via `supabase.auth.signUp()`, la ligne était bien créée dans `auth.users`, mais **aucun enregistrement n'apparaissait dans `public.profiles`**.
2. **Redirection muette sans feedback :**  
   Après avoir cliqué sur le lien de confirmation envoyé par email (`Confirm your email`), le navigateur était redirigé vers l'URL racine avec un fragment de hachage :
   ```
   http://localhost:3000/#access_token=eyJhbGciOi...&refresh_token=...&type=signup
   ```
   Comme les fragments (`#...`) ne sont jamais transmis au serveur HTTP par les navigateurs, Next.js servait la page d'accueil par défaut sans afficher de confirmation, et l'utilisateur restait bloqué sans savoir si son compte était validé ni comment accéder à son espace.

---

## 2. Architecture de Synchronisation Dual-Layer

Pour garantir une résilience totale (100 % de création de profils, que ce soit en direct dans PostgreSQL ou via les requêtes web), une architecture **Dual-Layer** a été déployée :

```
                                 [ Inscription / Confirmation ]
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     ▼                                                     ▼
           [ COUCHE 1 : BASE SQL ]                               [ COUCHE 2 : APPLICATION ]
     Trigger Postgres on auth.users                        Route API /api/auth/sync-profile
                     │                                                     │
                     ▼                                                     ▼
        handle_new_auth_user()                                     Service Role Key
                     │                                                     │
                     └──────────────────────────┬──────────────────────────┘
                                                │
                                                ▼
                                   [ public.profiles ]
                                   - id (UUID = auth.uid)
                                   - email
                                   - display_name
                                   - role ('teacher' | 'student')
                                   - is_guest (false)
```

---

## 3. Couche 1 : Le Trigger PostgreSQL (`auth.users` ➔ `public.profiles`)

Le trigger s'exécute immédiatement lors de l'insertion dans `auth.users`. Il utilise `SECURITY DEFINER` pour accéder à `public.profiles` avec les privilèges administrateur de la base.

### Code SQL du Trigger :

```sql
-- 1. Fonction de synchronisation déclenchée sur auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, role, is_guest)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        false
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
        role = COALESCE(EXCLUDED.role, public.profiles.role);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger attaché à auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();
```

### Caractéristiques :
* **Extraction des métadonnées :** Lit `NEW.raw_user_meta_data->>'display_name'` et `NEW.raw_user_meta_data->>'role'` injectés lors du `signUp()`.
* **Valeurs par défaut robustes :** Si le nom est omis, il utilise la racine de l'email (`split_part`). Si le rôle est absent, `'student'` est attribué par défaut.
* **Idempotence (`ON CONFLICT (id) DO UPDATE`) :** Si le profil existe déjà, l'email et le nom sont mis à jour sans écraser un rôle existant.

---

## 4. Couche 2 : Route Serveur de Synchronisation (`/api/auth/sync-profile`)

Située dans [`app/api/auth/sync-profile/route.ts`](file:///c:/dev/_current_apps/meta-hackaton-socratix-java-oop-mentor/app/api/auth/sync-profile/route.ts).

### Rôle :
* Appelé côté client dès qu'une session est initialisée (sur `/auth/callback`, sur `AuthHashListener`, ou sur `/login`).
* Utilise `getServiceSupabase()` avec `SUPABASE_SERVICE_ROLE_KEY` qui contourne les politiques RLS restrictives et garantit que la ligne `public.profiles` est créée ou synchronisée même si le trigger base avait un délai de propagation.
* Payload JSON :
  ```json
  {
    "id": "559cecbe-5c93-4c5f-8139-754d18be211b",
    "email": "abou.aziz.belhassen@gmail.com",
    "display_name": "Abou Aziz Belhassen",
    "role": "teacher"
  }
  ```

---

## 5. Gestion des Fragments d'URL `#access_token` & Callback UX

### A. Composant `components/AuthHashListener.tsx`
* Monté en haut de [`app/page.tsx`](file:///c:/dev/_current_apps/meta-hackaton-socratix-java-oop-mentor/app/page.tsx).
* Détecte si `window.location.hash` contient `access_token=`.
* Appelle `supabase.auth.getSession()` pour initialiser la session locale.
* Synchronise immédiatement le profil via `/api/auth/sync-profile`.
* Affiche une bannière animée en haut de page :
  * Badge rôle : **Enseignant** ou **Étudiant**.
  * Bouton d'action directe : **Accéder au Hub Enseignant** (`/teacher`) ou **Accéder au Workspace** (`/student`).
* Nettoie silencieusement le hash de l'URL (`window.history.replaceState`) sans recharger la page.

### B. Page Dédiée `/auth/callback`
* Située dans [`app/auth/callback/page.tsx`](file:///c:/dev/_current_apps/meta-hackaton-socratix-java-oop-mentor/app/auth/callback/page.tsx).
* Utilisée par `emailRedirectTo: `${origin}/auth/callback`` lors des nouveaux signups.
* Affiche un écran de confirmation élégant avec loader, félicitations, compte à rebours de 3 secondes et redirection automatique vers l'espace approprié (`/teacher` ou `/student`).

---

## 6. Historique de Provisionnement & Comptes Utilisateurs

| UID Supabase (`auth.users`) | Email | Rôle | Display Name | Statut Profil |
| :--- | :--- | :---: | :--- | :---: |
| `559cecbe-5c93-4c5f-8139-754d18be211b` | `abou.aziz.belhassen@gmail.com` | `teacher` | `Abou Aziz Belhassen` | ✅ Synchronisé & Actif |
| `11111111-1111-1111-1111-111111111111` | `mohamed.belhassen@fsg.rnu.tn` | `teacher` | `Prof. Belhassen` | ✅ Seed Fixe |
| `22222222-2222-2222-2222-222222222222` | `alice.student@fsg.rnu.tn` | `student` | `Alice` | ✅ Seed Fixe (Guest) |
| `33333333-3333-3333-3333-333333333333` | `bob.student@fsg.rnu.tn` | `student` | `Bob` | ✅ Seed Fixe (Guest) |
| `44444444-4444-4444-4444-444444444444` | *NULL* | `student` | `Guest Explorer` | ✅ Seed Fixe (Guest) |
| `55555555-5555-5555-5555-555555555555` | `ines.student@fsg.rnu.tn` | `student` | `Ines` | ✅ Seed Fixe (Guest) |

