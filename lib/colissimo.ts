/**
 * Colissimo (colissimodelivery.tn), the delivery company. Server-only: it uses the tokens from
 * the Colissimo sender account (Paramètres → APIs), COLISSIMO_ADD_TOKEN for creating parcels
 * and COLISSIMO_TRACKING_TOKEN for their status.
 *
 * The API has two calls: create a parcel (returns its barcode and delivery slip links) and
 * get one parcel's status by barcode. Both take form fields and answer JSON with `status: 1`
 * on success; otherwise `status_message` says why.
 */
import { COLISSIMO_GOVERNORATES } from '@/lib/colissimo-data';

// COLISSIMO_API_URL overrides the address for testing against a stand-in server.
const BASE_URL = process.env.COLISSIMO_API_URL || 'https://colissimodelivery.tn/api/v1';
const TIMEOUT_MS = 20_000;

export function colissimoConfigured() {
    return { add: !!process.env.COLISSIMO_ADD_TOKEN, tracking: !!process.env.COLISSIMO_TRACKING_TOKEN };
}

/** Fields of a new parcel, as Colissimo names them. */
export interface ParcelRequest {
    nom: string;
    gouvernerat: string;
    ville: string;
    adresse: string;
    tel: string;
    tel2?: string;
    designation: string;
    nb_article: number;
    /** Cash to collect from the customer, in TND. */
    prix: number;
    msg?: string;
    echange: 'oui' | 'non';
    article?: string;
    nb_echange?: number;
    ouvrir: 0 | 1;
    fragile: 0 | 1;
    type_colis: 1 | 2 | 3;
}

export class ColissimoError extends Error {
    constructor(message: string, readonly reachable: boolean) {
        super(message);
    }
}

async function call(endpoint: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    let response: Response;
    try {
        response = await fetch(`${BASE_URL}/${endpoint}`, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
    } catch (error) {
        throw new ColissimoError(`Colissimo could not be reached (${(error as Error).name === 'TimeoutError' ? 'timeout' : (error as Error).message})`, false);
    }
    const text = await response.text();
    let json: Record<string, unknown>;
    try {
        json = JSON.parse(text);
    } catch {
        throw new ColissimoError(`Colissimo answered ${response.status} with an unexpected response: ${text.slice(0, 200)}`, true);
    }
    if (Number(json.status) !== 1) {
        throw new ColissimoError(String(json.status_message || json.message || `Colissimo refused the request (HTTP ${response.status})`), true);
    }
    return json;
}

/** Creates the parcel. Not retried: a second call would create a second parcel. */
export async function createParcel(parcel: ParcelRequest) {
    const token = process.env.COLISSIMO_ADD_TOKEN;
    if (!token) throw new ColissimoError('COLISSIMO_ADD_TOKEN is not set', false);
    if (!COLISSIMO_GOVERNORATES.includes(parcel.gouvernerat)) throw new ColissimoError(`Unknown governorate: ${parcel.gouvernerat}`, false);
    const json = await call('post.php', {
        nom: parcel.nom,
        gouvernerat: parcel.gouvernerat,
        ville: parcel.ville,
        adresse: parcel.adresse,
        tel: parcel.tel,
        tel2: parcel.tel2 ?? '',
        designation: parcel.designation,
        nb_article: String(parcel.nb_article),
        prix: String(parcel.prix),
        msg: parcel.msg ?? '',
        echange: parcel.echange,
        article: parcel.article ?? '',
        nb_echange: String(parcel.nb_echange ?? 0),
        ouvrir: String(parcel.ouvrir),
        fragile: String(parcel.fragile),
        type_colis: String(parcel.type_colis),
        token,
    });
    const barcode = String(json.status_message ?? '').trim();
    if (!barcode) throw new ColissimoError('Colissimo accepted the parcel but returned no barcode', true);
    return {
        barcode,
        labelUrl: typeof json.lien === 'string' ? json.lien : null,
        labelZebraUrl: typeof json.lien_zebra === 'string' ? json.lien_zebra : null,
    };
}

/** Current status of one parcel. */
export async function trackParcel(barcode: string) {
    const token = process.env.COLISSIMO_TRACKING_TOKEN;
    if (!token) throw new ColissimoError('COLISSIMO_TRACKING_TOKEN is not set', false);
    const json = await call('etat.php', { token, code: barcode });
    return {
        status: String(json.etat ?? 'Inconnu').trim() || 'Inconnu',
        reason: String(json.motif ?? '').trim(),
        previousStatus: String(json.pre_etat ?? '').trim(),
    };
}
