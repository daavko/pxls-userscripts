import {
    type AnyNode,
    type ArrayExpression,
    type CallExpression,
    type ExpressionStatement,
    type FunctionExpression,
    type Identifier,
    type Literal,
    type ObjectExpression,
    Parser,
    type Program,
    type Property,
    type UnaryExpression,
} from 'acorn';
import type { PxlsModules } from '../pxls/pxls-modules';
import { debug } from './debug';
import { hashString } from './hash';

let ORIGINAL_SCRIPT_BLOCKER_INSTALLED = false;
let MODULE_REPLACEMENT_PROMISE: Promise<void> | null = null;
let EXPECTED_JS_HASH: string | null = null;
const MODULE_REPLACEMENTS: ModuleReplacement[] = [];

export interface ModuleReplacement {
    moduleName: keyof PxlsModules;
    replacementFunctionSrc: string;
}

export function registerModuleReplacement(expectedJsHash: string, replacement: ModuleReplacement): void {
    maybeInstallOriginalScriptBlocker();

    if (EXPECTED_JS_HASH == null) {
        EXPECTED_JS_HASH = expectedJsHash;
    } else if (EXPECTED_JS_HASH !== expectedJsHash) {
        throw new Error(
            `Module replacement expected hash ${expectedJsHash} does not match current expected hash ${EXPECTED_JS_HASH}`,
        );
    }

    const existingReplacement = MODULE_REPLACEMENTS.some((r) => r.moduleName === replacement.moduleName);
    if (existingReplacement) {
        throw new Error(`Module replacement for index ${replacement.moduleName} already registered`);
    }
    MODULE_REPLACEMENTS.push(replacement);
    debug('registered module replacement', replacement.moduleName, expectedJsHash);
}

export async function waitForModuleReplacement(): Promise<void> {
    if (MODULE_REPLACEMENT_PROMISE) {
        return MODULE_REPLACEMENT_PROMISE;
    }

    const { promise, resolve, reject } = Promise.withResolvers<void>();
    MODULE_REPLACEMENT_PROMISE = promise;

    window.addEventListener('load', () => {
        jsLoadObserver.disconnect();
        debug('pxls.js script blocker disconnected');

        if (window.App) {
            reject(new Error('pxls.js script blocker installed after App loaded'));
            return;
        }

        if (EXPECTED_JS_HASH != null) {
            runModuleReplacement(EXPECTED_JS_HASH, MODULE_REPLACEMENTS)
                .then(() => {
                    resolve();
                })
                .catch((e: unknown) => {
                    reject(new Error('pxls.js module replacement failed', { cause: e }));
                });
        }
    });

    return promise;
}

const jsLoadObserver = new MutationObserver((mutations) => {
    const scriptNodes = mutations
        .filter((mutation) => mutation.type === 'childList')
        .flatMap((mutation) => [...mutation.addedNodes])
        .filter((node) => node instanceof HTMLScriptElement);
    for (const node of scriptNodes) {
        const scriptSrc = node.src;
        if (scriptSrc === location.origin + '/pxls.js') {
            debug('found pxls.js script node');
            // node.addEventListener('load', () => {
            //     // todo: somehow the node loaded even though we changed the type, throw an error
            // });
            node.type = 'none/blocked';
        }
    }
});

function maybeInstallOriginalScriptBlocker(): void {
    if (document.readyState !== 'loading') {
        throw new Error('Attempted to install pxls.js script blocker after document load');
    }

    if (ORIGINAL_SCRIPT_BLOCKER_INSTALLED) {
        return;
    }

    jsLoadObserver.observe(document.documentElement, { childList: true, subtree: true });
    ORIGINAL_SCRIPT_BLOCKER_INSTALLED = true;
    debug('pxls.js script blocker installed');
}

function createModuleReplacementFunctionSrc(replacementSrc: string): string {
    return `function(requireFn,moduleExport){${replacementSrc}}`;
}

async function runModuleReplacement(expectedHash: string, replacements: ModuleReplacement[]): Promise<void> {
    debug('running module replacement', expectedHash, replacements);
    const scriptText = await loadPxlsJs();
    const scriptHash = await hashString(scriptText);

    if (expectedHash !== scriptHash) {
        throw new Error(`pxls.js hash ${scriptHash} does not match expected hash ${expectedHash}`);
    }

    const program = Parser.parse(scriptText, {
        ecmaVersion: 'latest',
        sourceType: 'script',
    });

    const [modules, entryPoint] = findBundle(program);
    const resolvedModules = createModuleGraph(modules, entryPoint);
    debug('resolved modules', resolvedModules);
    const modulesToReplace = resolvedModules
        .filter((module) => replacements.some((replacement) => replacement.moduleName === module.name))
        .sort((a, b) => a.start - b.start);
    debug('modules to replace', modulesToReplace);

    const codeParts: string[] = [];
    let lastEnd = 0;
    for (const module of modulesToReplace) {
        // all code before the module
        codeParts.push(scriptText.slice(lastEnd, module.start));

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- safe
        const replacement = replacements.find((r) => r.moduleName === module.name)!;
        codeParts.push(createModuleReplacementFunctionSrc(replacement.replacementFunctionSrc));

        lastEnd = module.end;
    }
    // all code after the last module
    codeParts.push(scriptText.slice(lastEnd));
    const newScriptText = codeParts.join('');
    console.log('would replace pxls.js with', newScriptText);

    if (window.App) {
        throw new Error(
            'pxls.js module replacement failed: App already loaded, detected just before script replacement',
        );
    }

    const scriptNode = document.createElement('script');
    scriptNode.textContent = newScriptText;
    document.body.appendChild(scriptNode);
    scriptNode.addEventListener('load', () => {
        debug('pxls.js module replacement script loaded');
    });
}

async function loadPxlsJs(): Promise<string> {
    const scriptResponse = await fetch(`${location.origin}/pxls.js`);
    if (!scriptResponse.ok) {
        throw new Error('Failed to load pxls.js', { cause: scriptResponse });
    }
    return await scriptResponse.text();
}

interface WebpackModule {
    id: number;
    code: FunctionExpression;
    dependencies: Record<string, number>;
}

interface ResolvedWebpackModule {
    name: string;
    start: number;
    end: number;
}

function assertNodeType<T extends AnyNode>(node: AnyNode, type: T['type']): asserts node is T {
    if (node.type !== type) {
        throw new Error(`Expected node type "${type}", got "${node.type}"`);
    }
}

function assertNodeTypeOneOf<T extends AnyNode>(node: AnyNode, types: readonly T['type'][]): asserts node is T {
    if (!types.includes(node.type as T['type'])) {
        throw new Error(`Expected node type one of ${types.join(', ')}, got "${node.type}"`);
    }
}

function findBundle(program: Program): [WebpackModule[], number] {
    let node: AnyNode = program.body[0];
    assertNodeType<ExpressionStatement>(node, 'ExpressionStatement');

    node = node.expression;
    assertNodeType<UnaryExpression>(node, 'UnaryExpression');

    node = node.argument;
    assertNodeType<CallExpression>(node, 'CallExpression');
    assertNodeType<FunctionExpression>(node.callee, 'FunctionExpression');

    const bundleArgs = node.arguments;
    if (bundleArgs.length !== 3) {
        throw new Error('Bundle args length not 3', { cause: bundleArgs });
    }

    const modules = validateModules(bundleArgs[0]);
    const entryPoint = validateEntryPoint(bundleArgs[2]);
    return [modules, entryPoint];
}

function validateModules(modulesNode: AnyNode): WebpackModule[] {
    assertNodeType<ObjectExpression>(modulesNode, 'ObjectExpression');

    const modules: WebpackModule[] = [];
    for (const prop of modulesNode.properties) {
        assertNodeType<Property>(prop, 'Property');
        const key = prop.key;
        assertNodeType<Literal>(key, 'Literal');
        if (typeof key.value !== 'number') {
            throw new Error('Module key not a number', { cause: prop });
        }
        const moduleId = key.value;

        const value = prop.value;
        assertNodeType<ArrayExpression>(value, 'ArrayExpression');
        if (value.elements.length !== 2) {
            throw new Error('Module value length not 2', { cause: prop });
        }
        const moduleCode = value.elements[0];
        if (moduleCode === null) {
            throw new Error('Module code is null', { cause: value.elements });
        }
        assertNodeType<FunctionExpression>(moduleCode, 'FunctionExpression');

        const moduleDependencies = value.elements[1];
        if (moduleDependencies === null) {
            throw new Error('Entry point dependencies is null', { cause: value.elements });
        }
        assertNodeType<ObjectExpression>(moduleDependencies, 'ObjectExpression');
        const dependencies: Record<string, number> = {};
        for (const depProp of moduleDependencies.properties) {
            assertNodeType<Property>(depProp, 'Property');
            const depKey = depProp.key;

            assertNodeTypeOneOf<Literal | Identifier>(depKey, ['Literal', 'Identifier']);
            let depName: string;
            if (depKey.type === 'Identifier') {
                depName = depKey.name;
            } else {
                if (typeof depKey.value !== 'string') {
                    throw new Error('Module dependency key not a string', { cause: depProp });
                }
                depName = depKey.value;
            }

            const depValue = depProp.value;
            assertNodeType<Literal>(depValue, 'Literal');
            if (typeof depValue.value !== 'number') {
                throw new Error('Module dependency value not a number', { cause: depProp });
            }
            dependencies[depName] = depValue.value;
        }
        modules.push({
            id: moduleId,
            code: moduleCode,
            dependencies,
        });
    }

    return modules;
}

function validateEntryPoint(possibleEntryPointsArray: AnyNode): number {
    assertNodeType<ArrayExpression>(possibleEntryPointsArray, 'ArrayExpression');
    if (possibleEntryPointsArray.elements.length !== 1) {
        throw new Error('Entry point length not 1', { cause: possibleEntryPointsArray });
    }
    const entryPoint = possibleEntryPointsArray.elements[0];
    if (entryPoint === null) {
        throw new Error('Null entry point', { cause: possibleEntryPointsArray });
    }
    assertNodeType<Literal>(entryPoint, 'Literal');

    if (typeof entryPoint.value !== 'number') {
        throw new Error('Entry point not a number', { cause: entryPoint });
    }
    return entryPoint.value;
}

function createModuleGraph(modules: WebpackModule[], entryPoint: number): ResolvedWebpackModule[] {
    const entryPointModule = modules.find((module) => module.id === entryPoint);
    if (!entryPointModule) {
        throw new Error('Entry point module not found', { cause: entryPoint });
    }

    const replaceableModules = Object.entries(entryPointModule.dependencies)
        .filter(([name]) => name.startsWith('./include/'))
        .map(([name, id]) => [name.replace('./include/', ''), id] as const);
    const processedModuleIds = new Set<number>();
    const resolvedModules: ResolvedWebpackModule[] = [];

    while (replaceableModules.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- safe
        const [moduleName, moduleId] = replaceableModules.pop()!;

        if (processedModuleIds.has(moduleId)) {
            continue;
        }

        const module = modules.find((m) => m.id === moduleId);
        if (!module) {
            throw new Error(`Module ${moduleName} (id ${moduleId}) not found`);
        }

        const start = module.code.start;
        const end = module.code.end;
        resolvedModules.push({
            name: moduleName,
            start,
            end,
        });
        processedModuleIds.add(moduleId);

        const moduleDependencies = Object.entries(module.dependencies)
            .filter(([name]) => name.startsWith('./'))
            .map(([name, id]) => [name.replace('./', ''), id] as const);
        replaceableModules.push(...moduleDependencies);
    }

    return resolvedModules;
}
