import { useState, useEffect, useRef } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../lib/firebase';
import { Device } from '../components/DeviceList';
import { Mode } from '../components/SystemModes';
import { LocalNotifications } from '@capacitor/local-notifications';

export const initialDevices: Device[] = [
    { id: '1', name: 'Iluminación Sala (PIR)', type: 'light', isOn: false, power: 45, lastActive: '-', isOnline: true },
    { id: '2', name: 'Sistema de Ventilación', type: 'motor', isOn: false, power: 350, lastActive: '-', isOnline: true },
    { id: '3', name: 'Carga de Confort', type: 'appliance', isOn: false, power: 800, lastActive: '-', isOnline: true },
    { id: '4', name: 'Alerta de Seguridad', type: 'security', isOn: false, power: 15, lastActive: '-', isOnline: true },
];

export function useEnergySystem() {
    const [devices, setDevices] = useState(initialDevices);
    const [metrics, setMetrics] = useState({
        voltage: 0,
        current: 0,
        power: 0,
        powerFactor: 0,
        energy: 0,
    });
    const [currentMode, setCurrentMode] = useState<Mode>('normal');
    const [powerLimit, setPowerLimit] = useState(1200);
    const [isIntrusion, setIsIntrusion] = useState(false);
    const [isOnline, setIsOnline] = useState(false);

    // Settings State
    const [pushNotifications, setPushNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(true);
    const [currency, setCurrency] = useState('C$');

    const shedCooldown = useRef(false);
    const lastIntrusionAlert = useRef<number>(0);
    const lastUpdateRef = useRef<number>(Date.now());

    // Watchdog
    useEffect(() => {
        const watchdog = setInterval(() => {
            if (Date.now() - lastUpdateRef.current > 5000) {
                setIsOnline(false);
            }
        }, 1000);
        return () => clearInterval(watchdog);
    }, []);

    // Listeners Firebase
    useEffect(() => {
        const metricsRef = ref(db, 'system/metrics');
        const unsubscribeMetrics = onValue(metricsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setMetrics({
                    voltage: Number(data.v) || 0,
                    current: Number(data.i) || 0,
                    power: Number(data.p) || 0,
                    powerFactor: Number(data.pf) || 0,
                    energy: Number(data.e) || 0,
                });
                lastUpdateRef.current = Date.now();
                setIsOnline(true);
            }
        });

        const devicesRef = ref(db, 'system/devices');
        const unsubscribeDevices = onValue(devicesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setDevices(prev => prev.map(device => {
                    const deviceData = data[device.id];
                    return deviceData ? { ...device, isOn: deviceData.isOn } : device;
                }));
            }
        });

        const configRef = ref(db, 'system/config');
        const unsubscribeConfig = onValue(configRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.mode && data.mode !== currentMode) setCurrentMode(data.mode as Mode);
                if (data.powerLimit) setPowerLimit(data.powerLimit);
                if (data.pushNotifications !== undefined) setPushNotifications(data.pushNotifications);
                if (data.darkMode !== undefined) setDarkMode(data.darkMode);
                if (data.currency) setCurrency(data.currency);
            }
        });

        return () => {
            unsubscribeMetrics();
            unsubscribeDevices();
            unsubscribeConfig();
        };
    }, [currentMode]);

    // Load Shedding y Alerta Intruso
    useEffect(() => {
        if (currentMode === 'away') {
            const isIntentionalUse = devices.some(d => d.id !== '4' && d.isOn);
            if (isOnline && metrics.power > 10 && !isIntentionalUse) {
                setIsIntrusion(true);
                if (pushNotifications && Date.now() - lastIntrusionAlert.current > 60000) {
                    lastIntrusionAlert.current = Date.now();
                    LocalNotifications.schedule({
                        notifications: [{
                            title: "🚨 ALERTA DE INTRUSO",
                            body: `Consumo anómalo (${metrics.power}W) detectado.`,
                            id: 999,
                            schedule: { at: new Date(Date.now() + 1000) },
                        }]
                    }).catch(console.error);
                }
            } else {
                setIsIntrusion(false);
            }
        } else {
            setIsIntrusion(false);
        }

        if (metrics.power > powerLimit && !shedCooldown.current) {
            shedCooldown.current = true;
            const priorities = ['3', '1', '2'];
            for (const pId of priorities) {
                const d = devices.find(x => x.id === pId);
                if (d?.isOn) {
                    update(ref(db, `system/devices/${pId}`), { isOn: false });
                    if (pushNotifications) {
                        LocalNotifications.schedule({
                            notifications: [{ title: "⚠️ Sobrecarga Activa", body: `Desconectando ${d.name} por seguridad.`, id: Number(pId), schedule: { at: new Date(Date.now() + 1000) } }]
                        }).catch(console.error);
                    }
                    break;
                }
            }
            setTimeout(() => { shedCooldown.current = false; }, 2500);
        }
    }, [metrics.power, powerLimit, currentMode, devices, isOnline, pushNotifications]);

    const toggleDevice = (id: string) => {
        const device = devices.find(d => d.id === id);
        if (!device) return;

        if (currentMode === 'away' && !device.isOn) {
            const confirmOverride = window.confirm(
                "⚠️ MODO AWAY ACTIVO (Seguridad)\n\nEncender manualmente disparará la sirena. ¿Forzar encendido?"
            );
            if (!confirmOverride) return;
        }

        const newState = !device.isOn;
        setDevices(prev => prev.map(d => d.id === id ? { ...d, isOn: newState } : d));
        update(ref(db, `system/devices/${id}`), { isOn: newState }).catch(() => {
            setDevices(prev => prev.map(d => d.id === id ? { ...d, isOn: !newState } : d));
        });
    };

    const changeMode = (mode: Mode) => {
        setCurrentMode(mode);
        update(ref(db, 'system/config'), { mode }).catch(console.error);
    };

    const updateSetting = (key: string, value: any) => {
        update(ref(db, 'system/config'), { [key]: value });
    };

    return {
        devices,
        metrics,
        currentMode,
        isOnline,
        isIntrusion,
        pushNotifications,
        darkMode,
        currency,
        toggleDevice,
        changeMode,
        updateSetting
    };
}
