import * as React from 'react';
import { NavigationContext } from "./NavigationContext";
import { Command } from '@kitsy/blu-bus';


// export function useNavigation() {
//     const context = React.useContext(NavigationContext);
        
//     if (context === undefined) {
//         throw new Error("useNavigation must be used within a NavigationContext or Navigation Provider: " + context);
//     }

//     return { navigate: context.navigate }
// }

export function useNavigation() {
    const context = React.useContext(NavigationContext);
        
    if (context === undefined) {
        throw new Error("useNavigation must be used within a NavigationContext or Navigation Provider: " + context);
    }

    const navigate = (to: string) => context.send({ type: "navigate", target: to });
    const replace  = (to: string) => context.send({ type: "replace", target: to });
    const back     = () => context.send({ type: "back" });
    const forward  = () => context.send({ type: "forward" });
    const send = (cmd: Command) => context.send(cmd);

    return { location: context.location, navigate, replace, back, forward, send  }
}