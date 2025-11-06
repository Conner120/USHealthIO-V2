"use server"
import {prisma} from "@repo/database";

export async function getName(name: string, part: string | undefined, exactMatch: string | undefined, path: string, href: string, table?: string) {
//     name string {{displayName}} and the part contains directions to parse params for the table ex:insurance/companies/{{id}} should
//     query the table for the id and return the name
    if (table) {
        // find vars with [NAME]
        const queryVars = path.split("/").filter(p => p.startsWith("[") && p.endsWith("]")).map(p => p.slice(1, -1));
        const partVars = (part ?? exactMatch ?? '').split("/").filter(p => p.startsWith("[") && p.endsWith("]")).map(p => p.slice(1, -1));
        const where: {
            [key: string]: string
        } = {};
        for (let i = 0; i < queryVars.length; i++) {
            where[queryVars[i]] = partVars[i]
        }
        // {{NAME}} => NAME and include NAME in the select object
        const selectKeys: {
            [key: string]: boolean
        } = {};
        {
            {
                selectKeys
            }
        }
        const nameKeys = name.match(/{{(.*?)}}/g)?.map(k => k.replace("{{", "").replace("}}", "")) || [];
        for (let i = 0; i < nameKeys.length; i++) {
            selectKeys[nameKeys[i]] = true
        }
        // add parts to selectKeys
        for (let i = 0; i < partVars.length; i++) {
            selectKeys[partVars[i]] = true
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const variables = await prisma[table].findFirst({
            where: where,
            select: selectKeys,
        })
        if (!variables) {
            return {linkName: name, linkHref: "/"}
        }
        for (const key of nameKeys) {
            name = name.replace(`{{${key}}}`, (variables as never)[key] || '')
        }
        // take the part and add / to start and replace [NAME] with variables[NAME]`
        let newLink = (part ?? exactMatch ?? '');
        // replace [NAME] with variables[NAME]
        for (let i = 0; i < partVars.length; i++) {
            newLink = newLink.replace(`[${partVars[i]}]`, (variables as never)[partVars[i]] || '')
        }
        return {linkName: name, linkHref: `/${newLink}`}
    }
    // fetch the name from the table if table is provided
    return {linkName: name, linkHref: href}
}
