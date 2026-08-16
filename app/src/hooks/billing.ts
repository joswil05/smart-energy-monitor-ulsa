export const calculateTotalCost = (kwh: number, currency: string, customTariffRate?: number) => {
    // Si el usuario configuró una tarifa personalizada específica (> 0)
    if (customTariffRate && customTariffRate > 0) {
        return Number((kwh * customTariffRate).toFixed(2));
    }

    // Tarifas Disnorte-Dissur 2025/2026 (León / Managua)
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
        return Number((cost / 36.8).toFixed(2)); // Conversión aproximada USD (1 USD = ~36.8 NIO)
    }
    return Number(cost.toFixed(2));
};
