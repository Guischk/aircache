# SQLite vs Airtable Performance Benchmark

**Date:** 21/09/2025
**Tables testées:** 19
**Scénarios:** 4

## 🎯 Résumé Exécutif

- **Performance moyenne:** SQLite est Infinityx plus rapide qu'Airtable
- **Réduction de latence:** 99.8% en moyenne
- **Fiabilité:** 0 échec sur 1615 requêtes SQLite

## 📊 Résultats Détaillés

| Table | Scénario | SQLite (ms) | Airtable (ms) | Facteur | Réduction |
|-------|----------|-------------|---------------|---------|----------|
| table_A | single_record | 0.0 | 251.9 | Infinityx | 100.0% |
| table_A | small_batch | 2.9 | 245.4 | 84.2x | 98.8% |
| table_A | medium_batch | 3.1 | 260.7 | 83.9x | 98.8% |
| table_A | table_scan | 3.0 | 259.5 | 85.2x | 98.8% |
| table_B | single_record | 0.0 | 234.8 | Infinityx | 100.0% |
| table_B | small_batch | 2.1 | 236.5 | 111.9x | 99.1% |
| table_B | medium_batch | 0.7 | 228.6 | 331.0x | 99.7% |
| table_B | table_scan | 0.7 | 231.4 | 324.5x | 99.7% |
| table_C | single_record | 0.0 | 247.8 | Infinityx | 100.0% |
| table_C | small_batch | 1.3 | 269.5 | 200.8x | 99.5% |
| table_C | medium_batch | 0.9 | 330.3 | 387.4x | 99.7% |
| table_C | table_scan | 2.7 | 3511.7 | 1306.6x | 99.9% |
| table_D | single_record | 0.0 | 261.5 | Infinityx | 100.0% |
| table_D | small_batch | 1.3 | 236.3 | 183.3x | 99.5% |
| table_D | medium_batch | 2.4 | 240.9 | 100.1x | 99.0% |
| table_D | table_scan | 2.2 | 227.9 | 103.6x | 99.0% |
| table_E | single_record | 0.0 | 235.1 | Infinityx | 100.0% |
| table_E | small_batch | 0.7 | 255.5 | 367.8x | 99.7% |
| table_E | medium_batch | 1.0 | 253.1 | 255.9x | 99.6% |
| table_E | table_scan | 0.8 | 271.1 | 358.7x | 99.7% |
| table_F | single_record | 0.0 | 235.1 | Infinityx | 100.0% |
| table_F | small_batch | 2.4 | 234.9 | 99.2x | 99.0% |
| table_F | medium_batch | 2.2 | 245.2 | 111.0x | 99.1% |
| table_F | table_scan | 2.5 | 260.6 | 104.8x | 99.0% |
| table_G | single_record | 0.0 | 255.7 | Infinityx | 100.0% |
| table_G | small_batch | 2.0 | 229.7 | 114.0x | 99.1% |
| table_G | medium_batch | 2.5 | 237.5 | 94.7x | 98.9% |
| table_G | table_scan | 1.1 | 234.6 | 220.6x | 99.5% |
| table_H | single_record | 0.0 | 232.8 | Infinityx | 100.0% |
| table_H | small_batch | 0.7 | 233.3 | 317.2x | 99.7% |
| table_H | medium_batch | 2.0 | 247.1 | 122.3x | 99.2% |
| table_H | table_scan | 3.0 | 236.1 | 80.0x | 98.7% |
| table_I | single_record | 0.0 | 234.1 | Infinityx | 100.0% |
| table_I | small_batch | 1.0 | 241.9 | 236.2x | 99.6% |
| table_I | medium_batch | 2.3 | 252.7 | 109.7x | 99.1% |
| table_I | table_scan | 0.5 | 242.5 | 450.9x | 99.8% |
| table_J | single_record | 0.0 | 239.0 | Infinityx | 100.0% |
| table_J | small_batch | 0.0 | 244.5 | Infinityx | 100.0% |
| table_J | medium_batch | 0.0 | 279.8 | Infinityx | 100.0% |
| table_J | table_scan | 0.0 | 298.4 | Infinityx | 100.0% |
| table_K | single_record | 0.0 | 230.8 | Infinityx | 100.0% |
| table_K | small_batch | 0.0 | 247.6 | Infinityx | 100.0% |
| table_K | medium_batch | 0.0 | 247.4 | Infinityx | 100.0% |
| table_K | table_scan | 0.0 | 249.6 | Infinityx | 100.0% |
| table_L | single_record | 0.0 | 247.9 | Infinityx | 100.0% |
| table_L | small_batch | 0.0 | 232.8 | Infinityx | 100.0% |
| table_L | medium_batch | 0.0 | 231.8 | Infinityx | 100.0% |
| table_L | table_scan | 0.0 | 230.7 | Infinityx | 100.0% |
| table_M | single_record | 0.0 | 226.9 | Infinityx | 100.0% |
| table_M | small_batch | 0.0 | 248.3 | Infinityx | 100.0% |
| table_M | medium_batch | 0.0 | 243.6 | Infinityx | 100.0% |
| table_M | table_scan | 0.0 | 231.3 | Infinityx | 100.0% |
| table_N | single_record | 0.0 | 260.0 | Infinityx | 100.0% |
| table_N | small_batch | 0.0 | 226.1 | Infinityx | 100.0% |
| table_N | medium_batch | 0.0 | 230.6 | Infinityx | 100.0% |
| table_N | table_scan | 0.0 | 227.3 | Infinityx | 100.0% |
| table_O | single_record | 0.0 | 234.9 | Infinityx | 100.0% |
| table_O | small_batch | 0.0 | 236.1 | Infinityx | 100.0% |
| table_O | medium_batch | 0.0 | 235.0 | Infinityx | 100.0% |
| table_O | table_scan | 0.0 | 240.0 | Infinityx | 100.0% |
| table_P | single_record | 0.0 | 262.9 | Infinityx | 100.0% |
| table_P | small_batch | 0.0 | 303.8 | Infinityx | 100.0% |
| table_P | medium_batch | 0.0 | 294.4 | Infinityx | 100.0% |
| table_P | table_scan | 0.0 | 296.4 | Infinityx | 100.0% |
| table_Q | single_record | 0.0 | 282.5 | Infinityx | 100.0% |
| table_Q | small_batch | 0.0 | 239.0 | Infinityx | 100.0% |
| table_Q | medium_batch | 0.0 | 254.5 | Infinityx | 100.0% |
| table_Q | table_scan | 0.0 | 241.9 | Infinityx | 100.0% |
| table_R | single_record | 0.0 | 254.2 | Infinityx | 100.0% |
| table_R | small_batch | 0.0 | 247.4 | Infinityx | 100.0% |
| table_R | medium_batch | 0.0 | 262.5 | Infinityx | 100.0% |
| table_R | table_scan | 0.0 | 239.9 | Infinityx | 100.0% |
| table_S | single_record | 0.0 | 239.7 | Infinityx | 100.0% |
| table_S | small_batch | 0.0 | 249.4 | Infinityx | 100.0% |
| table_S | medium_batch | 0.0 | 235.7 | Infinityx | 100.0% |
| table_S | table_scan | 0.0 | 248.4 | Infinityx | 100.0% |

## 💰 Impact Business

### Coûts Airtable évités
- **Rate limits:** 5 requêtes/seconde maximum
- **Quotas:** Limites par plan tarifaire
- **Latence réseau:** 100-500ms par requête

### Bénéfices SQLite
- **Performance:** Infinityx plus rapide
- **Disponibilité:** 100% (pas de dépendance externe)
- **Évolutivité:** Illimitée en local
- **Simplicité:** Architecture unifiée

