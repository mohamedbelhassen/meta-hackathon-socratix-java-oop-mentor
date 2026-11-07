import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
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

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const COURSE_ID = 'bb92aacf-8332-4c7d-b02f-856736ed9999';

// 1. TP1 Act 2 Solution
const TP1_ACT2_SOLUTION_CODE = `public class YallaPosV1 {
  public static void main(String[] args) {
    final String STORE_LOCATION = "Yalla POS - FSG Gabès Campus";
    final String CASHIER_NAME = "Mohamed BELHASSEN";
    final double VAT_RATE = 0.19;
    final double STAMP_DUTY = 0.100;

    String itemName = "FSG Student Panini Menu";
    double unitPriceHT = 4.500;
    int quantity = 3;
    boolean isTakeaway = true;

    double totalHT = unitPriceHT * quantity;
    double vatAmount = totalHT * VAT_RATE;
    double totalTTC = totalHT + vatAmount + STAMP_DUTY;
    int loyaltyPoints = (int) totalTTC;

    System.out.println("========================================");
    System.out.println("\\"" + STORE_LOCATION + "\\"");
    System.out.println("Cashier :\\t" + CASHIER_NAME);
    System.out.println("Takeaway :\\t" + isTakeaway);
    System.out.println("----------------------------------------");
    System.out.println("Item :\\t\\t" + itemName);
    System.out.println("Quantity :\\t" + quantity);
    System.out.println("Unit Price HT :\\t" + unitPriceHT + " TND");
    System.out.println("Total HT :\\t" + totalHT + " TND");
    System.out.println("VAT (19%) :\\t" + vatAmount + " TND");
    System.out.println("Stamp Duty :\\t" + STAMP_DUTY + " TND");
    System.out.println("----------------------------------------");
    System.out.println("TOTAL TTC:\\t" + totalTTC + " TND");
    System.out.println("Loyalty Points Earned: " + loyaltyPoints + " pts");
    System.out.println("========================================");
  }
}`;

// 2. TP3 Act 1 Solution
const TP3_ACT1_SOLUTION_CODE = `import java.util.Scanner;

public class FsgPortalAuth {
  public static void main(String[] args) {
    Scanner scanner = new Scanner(System.in);
    final int SECRET_PIN = 6029;
    final int MAX_ATTEMPTS = 3;
    int attemptsUsed = 0;
    boolean isAuthenticated = false;

    System.out.println("=== FSG Student Portal Gateway ===");
    do {
      System.out.print("Enter 4-digit FSG Portal PIN: ");
      int enteredPin = scanner.nextInt();
      attemptsUsed++;

      if (enteredPin == SECRET_PIN) {
        isAuthenticated = true;
        System.out.println("Access Granted! Welcome to Mohamed BELHASSEN's Course Portal.");
        break;
      } else {
        int remaining = MAX_ATTEMPTS - attemptsUsed;
        if (remaining > 0) {
          System.out.println("Incorrect PIN. Remaining attempts: " + remaining);
        }
      }
    } while (attemptsUsed < MAX_ATTEMPTS);

    if (!isAuthenticated) {
      System.out.println("SECURITY ALERT: Terminal locked! Contact FSG IT Administration.");
    }
    scanner.close();
  }
}`;

// 3. TP3 Act 2 Solution
const TP3_ACT2_SOLUTION_CODE = `import java.util.Scanner;

public class YallaPosV3 {
  public static void main(String[] args) {
    Scanner scanner = new Scanner(System.in);
    final double VAT_RATE = 0.19;
    final double STAMP_DUTY = 0.100;
    double grandTotalHT = 0.0;
    int totalItemCount = 0;
    int lineItemIndex = 1;

    System.out.println("=== Yalla POS Shopping Cart Accumulator ===");
    while (true) {
      System.out.print("Item #" + lineItemIndex + " - Enter Quantity (or -1 to checkout): ");
      int quantity = scanner.nextInt();

      if (quantity == -1) {
        break;
      }

      if (quantity <= 0) {
        System.out.println("Invalid quantity! Please re-enter line item.");
        continue;
      }

      System.out.print("Enter Unit Price HT (TND): ");
      double unitPrice = scanner.nextDouble();

      double lineHT = unitPrice * quantity;
      grandTotalHT += lineHT;
      totalItemCount += quantity;
      lineItemIndex++;
    }

    double vatAmount = grandTotalHT * VAT_RATE;
    double totalTTC = grandTotalHT + vatAmount + STAMP_DUTY;

    System.out.println("----------------------------------------");
    System.out.println("Total Units Scanned : " + totalItemCount + " items");
    System.out.println("Subtotal (Total HT) : " + grandTotalHT + " TND");
    System.out.println("VAT (19%) : " + vatAmount + " TND");
    System.out.println("Stamp Duty : " + STAMP_DUTY + " TND");
    System.out.println("GRAND TOTAL TTC : " + totalTTC + " TND");
    System.out.println("========================================");
    scanner.close();
  }
}`;

// 4. TP5 Act 2 Solution (ReceiptItem.java & YallaPosV5.java)
const TP5_ACT2_RECEIPT_ITEM_CODE = `public class ReceiptItem {
  String name;
  double unitPriceHT;
  int quantity;

  public double getLineTotalHT() {
    return unitPriceHT * quantity;
  }
}`;

const TP5_ACT2_YALLAPOS_CODE = `import java.util.Scanner;

public class YallaPosV5 {
  public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);
    ReceiptItem[] cart = new ReceiptItem[10];
    int itemCount = 0;
    final double VAT_RATE = 0.19;
    final double STAMP_DUTY = 0.100;

    System.out.println("=== Yalla POS Terminal - Object Shopping Cart ===");
    while (itemCount < cart.length) {
      System.out.print("Item #" + (itemCount + 1) + " Name (or 'DONE' to finish): ");
      String name = sc.nextLine().trim();
      if (name.equalsIgnoreCase("DONE")) {
        break;
      }

      System.out.print("Unit Price HT (TND): ");
      double price = Double.parseDouble(sc.nextLine().trim());

      System.out.print("Quantity: ");
      int qty = Integer.parseInt(sc.nextLine().trim());

      ReceiptItem item = new ReceiptItem();
      item.name = name;
      item.unitPriceHT = price;
      item.quantity = qty;

      cart[itemCount] = item;
      itemCount++;
    }

    System.out.println("----------------------------------------");
    double grandTotalHT = 0.0;
    for (int i = 0; i < itemCount; i++) {
      double lineHT = cart[i].getLineTotalHT();
      grandTotalHT += lineHT;
      System.out.println(cart[i].name + "\\t x" + cart[i].quantity + "\\t = " + lineHT + " TND");
    }

    double vat = grandTotalHT * VAT_RATE;
    double totalTTC = grandTotalHT + vat + STAMP_DUTY;

    System.out.println("----------------------------------------");
    System.out.println("Subtotal (Total HT) :\\t" + grandTotalHT + " TND");
    System.out.println("VAT (19%) :\\t\\t" + vat + " TND");
    System.out.println("Stamp Duty :\\t\\t" + STAMP_DUTY + " TND");
    System.out.println("GRAND TOTAL TTC :\\t" + totalTTC + " TND");
    System.out.println("========================================");
    sc.close();
  }
}`;

async function main() {
  // 1. Update TP1
  console.log('[1/3] Updating TP1 demo presets...');
  const { data: tp1, error: tp1Err } = await supabase
    .from('labs')
    .select('id, demo_presets')
    .eq('course_id', COURSE_ID)
    .eq('lab_number', 1)
    .single();

  if (tp1Err || !tp1) {
    console.error('Failed to fetch TP1:', tp1Err);
  } else {
    interface PresetFile { name: string; content: string; }
    interface Preset { key: string; files: PresetFile[]; [key: string]: unknown; }
    const presets = (tp1.demo_presets || []) as Preset[];
    const updated = presets.map((p) => {
      if (p.key === 'act_2_solution') {
        return {
          ...p,
          files: [{ name: 'YallaPosV1.java', content: TP1_ACT2_SOLUTION_CODE }],
        };
      }
      return p;
    });

    const { error: upErr } = await supabase
      .from('labs')
      .update({ demo_presets: updated })
      .eq('id', tp1.id);
    if (upErr) console.error('Error updating TP1:', upErr);
    else console.log('✓ TP1 act_2_solution updated successfully!');
  }

  // 2. Update TP3
  console.log('[2/3] Updating TP3 demo presets...');
  const { data: tp3, error: tp3Err } = await supabase
    .from('labs')
    .select('id, demo_presets')
    .eq('course_id', COURSE_ID)
    .eq('lab_number', 3)
    .single();

  if (tp3Err || !tp3) {
    console.error('Failed to fetch TP3:', tp3Err);
  } else {
    interface PresetFile { name: string; content: string; }
    interface Preset { key: string; files: PresetFile[]; [key: string]: unknown; }
    const presets = (tp3.demo_presets || []) as Preset[];
    const updated = presets.map((p) => {
      if (p.key === 'act_1_solution') {
        return {
          ...p,
          files: [{ name: 'FsgPortalAuth.java', content: TP3_ACT1_SOLUTION_CODE }],
        };
      }
      if (p.key === 'act_2_solution') {
        return {
          ...p,
          files: [{ name: 'YallaPosV3.java', content: TP3_ACT2_SOLUTION_CODE }],
        };
      }
      return p;
    });

    const { error: upErr } = await supabase
      .from('labs')
      .update({ demo_presets: updated })
      .eq('id', tp3.id);
    if (upErr) console.error('Error updating TP3:', upErr);
    else console.log('✓ TP3 act_1_solution and act_2_solution updated successfully!');
  }

  // 3. Update TP5
  console.log('[3/3] Updating TP5 demo presets...');
  const { data: tp5, error: tp5Err } = await supabase
    .from('labs')
    .select('id, demo_presets')
    .eq('course_id', COURSE_ID)
    .eq('lab_number', 5)
    .single();

  if (tp5Err || !tp5) {
    console.error('Failed to fetch TP5:', tp5Err);
  } else {
    interface PresetFile { name: string; content: string; }
    interface Preset { key: string; files: PresetFile[]; [key: string]: unknown; }
    const presets = (tp5.demo_presets || []) as Preset[];
    const updated = presets.map((p) => {
      if (p.key === 'act_2_solution') {
        return {
          ...p,
          files: [
            { name: 'ReceiptItem.java', content: TP5_ACT2_RECEIPT_ITEM_CODE },
            { name: 'YallaPosV5.java', content: TP5_ACT2_YALLAPOS_CODE },
          ],
        };
      }
      return p;
    });

    const { error: upErr } = await supabase
      .from('labs')
      .update({ demo_presets: updated })
      .eq('id', tp5.id);
    if (upErr) console.error('Error updating TP5:', upErr);
    else console.log('✓ TP5 act_2_solution updated successfully!');
  }

  console.log('✓ All 4 demo presets updated in Supabase!');
}

main().catch(console.error);
