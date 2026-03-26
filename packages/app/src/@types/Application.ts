import { AppContext } from '@kitsy/blu-context';
import type { ApplicationConfiguration } from './ApplicationConfiguration';

export interface ReactApplicationAttributes {
    init: AppContext;
    routes: any;
}
