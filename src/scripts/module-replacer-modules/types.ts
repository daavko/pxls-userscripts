import type { PxlsModules, PxlsModulesImportMap } from '../../pxls/pxls-modules';

export type ModuleImportFunction = <T extends keyof PxlsModulesImportMap>(moduleName: T) => PxlsModulesImportMap[T];

export interface ModuleExport<TModuleName extends keyof PxlsModules> {
    exports: Record<TModuleName, PxlsModulesImportMap[`./${TModuleName}`]>;
}

export type ModuleReplacementFunction<TModuleName extends keyof PxlsModules> = (
    requireFn: ModuleImportFunction,
    moduleExport: ModuleExport<TModuleName>,
) => void;