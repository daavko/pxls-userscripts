import * as v from 'valibot';

const initMessageSchema = v.pipe(
    v.string(),
    v.rawTransform(({ dataset, addIssue, NEVER }) => {
        try {
            return JSON.parse(dataset.value) as unknown;
        } catch (e) {
            addIssue({ message: 'unable to parse JSON: ' + String(e) });
            return NEVER;
        }
    }),
    v.object({
        type: v.literal('init'),
        enableDebug: v.boolean(),
    }),
);

export function bindInitEvent(): void {
    globalThis.addEventListener('message', ({ data }) => {
        const { success, output: initMessage } = v.safeParse(initMessageSchema, data);
        if (success) {
            const { enableDebug } = initMessage;
        }
    });
}
