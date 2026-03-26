import * as React from 'react';
import { bus, Command, componentRegistry } from '@kitsy/blu-bus';
import { NavigationContext } from "./NavigationContext";
import { navigationStore } from './NavigationStore';

export const NavigationProvider = ({ children }: { children: React.ReactNode }) => {

    const [location, setLocation] = React.useState(navigationStore.location);
    const [activeComponents, setActiveComponents] = React.useState<string[]>([]);

    React.useEffect(() => {
        const unsubNav = navigationStore.subscribe(setLocation);
        const unsubCmd = bus.subscribe(cmd => {
            console.log("NavigationProvider: received command", cmd);
            if (cmd.type === "open" && cmd.target) {
                setActiveComponents(prev => [...new Set([...prev, cmd.target!])]);
            } else if (cmd.type === "close" && cmd.target) {
                setActiveComponents(prev => prev.filter(c => c !== cmd.target));
            } else if (cmd.type === "navigate" && typeof cmd.payload === "string") {
                // navigationStore.navigate(cmd.payload);
                console.log("NavigationProvider: navigate to", cmd.payload);
            }
        });
        return () => {
            unsubNav();
            unsubCmd();
        };
    }, []);

    // React.useEffect(() => {
    //     const unsub = navigationStore.subscribe(setLocation);

    //     return () => {
    //         unsub();
    //     }
    // }, []);

    const send = React.useCallback((cmd: Command) => {
        console.log("NavigationProvider: sending navigation command", cmd);
        return bus.send(cmd)
    }, []);

    return (
        <NavigationContext value={{ location, send /* navigate: navigationStore.navigate.bind(navigationStore) */ }}>
            {children}
            {/* {activeComponents.map(urn => {
                const Comp = componentRegistry.get(urn);
                return Comp ? <Comp key={urn} /> : null;
            })} */}
        </NavigationContext>
    );
}