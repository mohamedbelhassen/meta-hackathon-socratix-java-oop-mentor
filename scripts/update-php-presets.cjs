const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || env['SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

const PHP_COURSE_ID = '0bc6bcf4-677a-430b-abd8-696becacb55f';
const LAB_1_ID = 'cc914079-f3db-4721-b242-e71f2b6e42a6';

const ACT_2_SOLUTION_PHP = `<?php
// Fonction d'évaluation de l'autorisation de dépôt de PFE
function evaluerDepotPFE($credits_obtenus, $moyenne_generale, $dossier_complet, $label) {
    echo "--- $label ---<br>\\n";
    echo "Crédits: $credits_obtenus | Moyenne: $moyenne_generale | Dossier: " . ($dossier_complet ? "Complet" : "Incomplet") . "<br>\\n";

    // Vérification des 3 critères : crédits entiers >= 120, moyenne >= 10, dossier complet
    if (is_int($credits_obtenus) && ($credits_obtenus >= 120) && ($moyenne_generale >= 10) && $dossier_complet) {
        echo "Autorisation de dépôt accordée.<br><br>\\n";
    } else {
        echo "Dépôt refusé. Conditions non satisfaites.<br>\\n";
        if (!is_int($credits_obtenus)) {
            echo "Motif de refus : Les crédits ($credits_obtenus) ne sont pas un entier strict (is_int retourne faux).<br>\\n";
        } elseif ($credits_obtenus < 120) {
            echo "Motif de refus : Crédits insuffisants ($credits_obtenus < 120).<br>\\n";
        } elseif ($moyenne_generale < 10) {
            echo "Motif de refus : Moyenne insuffisante ($moyenne_generale < 10).<br>\\n";
        } elseif (!$dossier_complet) {
            echo "Motif de refus : Dossier incomplet.<br>\\n";
        }
        echo "<br>\\n";
    }
}

// 1. Script initial : 120 crédits, 10.5 de moyenne, dossier complet -> Accordé
$credits_obtenus = 120;
$moyenne_generale = 10.5;
$dossier_complet = true;
evaluerDepotPFE($credits_obtenus, $moyenne_generale, $dossier_complet, "Script Initial");

// 2. Évaluation Cas A : 110 crédits (< 120), moyenne 12, dossier complet -> Refus
evaluerDepotPFE(110, 12, true, "Cas A (crédits < 120)");

// 3. Évaluation Cas B : 120.5 crédits, moyenne 14, dossier complet -> Refus car is_int(120.5) est faux
evaluerDepotPFE(120.5, 14, true, "Cas B (is_int(120.5) faux)");
?>`;

const ACT_3_SOLUTION_PHP = `<?php
// Test 1: Rôle étudiant -> Accès refusé
$role_utilisateur = "etudiant";
if ($role_utilisateur === "professeur") {
  echo "Accès autorisé à la grille d'évaluation.<br>\\n";
} else {
  echo "Accès refusé. Espace réservé au jury.<br>\\n";
}

// Test 2: Rôle professeur -> Accès autorisé
$role_professeur = "professeur";
if ($role_professeur === "professeur") {
  echo "Accès autorisé à la grille d'évaluation.<br>\\n";
} else {
  echo "Accès refusé. Espace réservé au jury.<br>\\n";
}
?>`;

async function main() {
  console.log('Fetching PHP Lab 1 from database...');
  const { data: lab, error: fetchErr } = await supabase
    .from('labs')
    .select('id, demo_presets')
    .eq('id', LAB_1_ID)
    .single();

  if (fetchErr || !lab) {
    console.error('Error fetching lab:', fetchErr);
    process.exit(1);
  }

  const updatedPresets = (lab.demo_presets || []).map((preset) => {
    if (preset.key === 'act_2_solution') {
      return {
        ...preset,
        files: [
          {
            name: 'activite2.php',
            content: ACT_2_SOLUTION_PHP,
          },
        ],
        description: 'Validated solution evaluating initial case, Case A (credits < 120) and Case B (is_int false).',
      };
    }
    if (preset.key === 'act_3_solution') {
      return {
        ...preset,
        files: [
          {
            name: 'activite3.php',
            content: ACT_3_SOLUTION_PHP,
          },
        ],
        description: 'Validated solution verifying both etudiant (refused) and professeur (authorized) roles.',
      };
    }
    return preset;
  });

  console.log('Updating demo_presets in labs table...');
  const { error: updateErr } = await supabase
    .from('labs')
    .update({ demo_presets: updatedPresets })
    .eq('id', LAB_1_ID);

  if (updateErr) {
    console.error('Error updating demo_presets:', updateErr);
    process.exit(1);
  }
  console.log('Successfully updated Lab 1 demo_presets.');

  // Invalidate course cache
  console.log('Invalidating PHP course cache...');
  const { error: cacheErr } = await supabase
    .from('courses')
    .update({ cache_version: Date.now() })
    .eq('id', PHP_COURSE_ID);

  if (cacheErr) {
    console.error('Error updating cache_version:', cacheErr);
  } else {
    console.log('Course cache invalidated successfully.');
  }

  // Verify updated lab
  const { data: verifiedLab } = await supabase
    .from('labs')
    .select('demo_presets')
    .eq('id', LAB_1_ID)
    .single();

  const act2Sol = verifiedLab?.demo_presets?.find((p) => p.key === 'act_2_solution');
  console.log('Verified act_2_solution content preview:');
  console.log(act2Sol?.files?.[0]?.content?.slice(0, 150));
}

main().catch(console.error);

