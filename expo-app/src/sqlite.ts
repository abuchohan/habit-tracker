import { HabitRecord } from '../../shared/domain';
export async function importLoop(_bytes: Uint8Array): Promise<HabitRecord[]> { throw new Error('Use the browser version to import Loop databases. JSON backups work on all platforms.'); }
export async function exportLoop(_records: HabitRecord[]): Promise<Uint8Array> { throw new Error('Use the browser version to export Loop databases.'); }
