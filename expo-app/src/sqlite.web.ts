import initSqlJs from 'sql.js';
import { HabitRecord } from '../../shared/domain';
import { readLoop, writeLoop } from '../../shared/loop-database';
const sql = () => initSqlJs({ locateFile: () => '/sql-wasm-browser.wasm' });
export async function importLoop(bytes: Uint8Array) { return readLoop(await sql(), bytes); }
export async function exportLoop(records: HabitRecord[]) { return writeLoop(await sql(), records); }
