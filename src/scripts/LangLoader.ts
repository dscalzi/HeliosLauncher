import { readFileSync } from 'fs-extra';
import { join } from 'path';
import type LangType from "../lang/en_US.json";

export class LangLoader {
    public static lang?: typeof LangType;

    public static loadLanguage(langId: string) {
        this.lang = readFileSync(join(__dirname, '..', 'lang', `${langId}.json`)).toJSON() as any || undefined;
    }

    public static query(langId: string) {
        if (!this.lang) return "";

        let query = langId.split('.')
        let res = this.lang
        for (let q of query) {
            res = res[q]
        }
        return res === this.lang ? {} : res
    }

    public static queryJS(id) {
        return this.query(`js.${id}`)
    }
}