import { showInfoMessage } from '../modules/message';
import { globalInit } from '../modules/pxls-init';

globalInit({ scriptId: 'milestoneWatcher', scriptName: 'Milestone watcher' });

showInfoMessage(
    "Milestone Watcher functionality has been moved. You can find more details in the Neuro-sama's Pixelers Discord server, or just ask @daavko directly. Please uninstall this script and install the new one from pxls.daavko.moe. This version of the script no longer does anything.",
    20_000,
);
