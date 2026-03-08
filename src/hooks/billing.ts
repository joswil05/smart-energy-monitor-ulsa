export const calculateTotalCost = (kwh: number, currency: string) => {
    // Tarifas Disnorte-Dissur 2025/2026 (León)
    const FIXED_CHARGE = 36.05;

    // Definición de bloques escalonados (anchos de banda)
    const blocks = [
        { width: 25, rate: 2.4807 },    // 0-25 kWh
        { width: 25, rate: 5.9337 },    // 26-50 kWh
        { width: 50, rate: 6.2212 },    // 51-100 kWh
        { width: 50, rate: 8.2693 },    // 101-150 kWh
        { width: 350, rate: 8.3895 },   // 151-500 kWh
        { width: 500, rate: 13.3253 },  // 501-1000 kWh
        { width: Infinity, rate: 15.1821 } // >1000 kWh
    ];

    let cost = FIXED_CHARGE;
    let remainingKwh = kwh;

    for (const block of blocks) {
        if (remainingKwh <= 0) break;

        const usageInBlock = Math.min(remainingKwh, block.width);
        cost += usageInBlock * block.rate;
        remainingKwh -= usageInBlock;
    }

    if (currency === '$') {
        return cost / 36.8; // Approximate conversion rate for USD
    }
    return cost;
};
