// Regions of the World
// as of 2025-10-25
//
// Adapted according to the United Nations Geoscheme
// see https://www.unicode.org/cldr/charts/48/supplemental/territory_containment_un_m_49.html
// see https://unstats.un.org/unsd/methodology/m49

export const REGIONS = [
    {
        name: "regionAfrica",
        id: "002",
        includes: [
            {
                name: "regionNorthernAfrica",
                id: "015",
                countries: ["DZ", "EG", "LY", "MA", "SD", "TN", "EH"]
            },
            {
                name: "regionEasternAfrica",
                id: "014",
                countries: ["IO", "BI", "KM", "DJ", "ER", "ET", "TF", "KE", "MG", "MW", "MU", "YT", "MZ", "RE", "RW", "SC", "SO", "SS", "UG", "ZM", "ZW"]
            },
            {
                name: "regionMiddleAfrica",
                id: "017",
                countries: ["AO", "CM", "CF", "TD", "CG", "CD", "GQ", "GA", "ST"]
            },
            {
                name: "regionSouthernAfrica",
                id: "018",
                countries: ["BW", "SZ", "LS", "NA", "ZA"]
            },
            {
                name: "regionWesternAfrica",
                id: "011",
                countries: ["BJ", "BF", "CV", "CI", "GM", "GH", "GN", "GW", "LR", "ML", "MR", "NE", "NG", "SH", "SN", "SL", "TG"]
            }
        ]
    },
    {
        name: "regionAmericas",
        id: "019",
        includes: [
            {
                name: "regionCaribbean",
                id: "029",
                countries: ["AI", "AG", "AW", "BS", "BB", "BQ", "VG", "KY", "CU", "CW", "DM", "DO", "GD", "GP", "HT", "JM", "MQ", "MS", "PR", "BL", "KN", "LC", "MF", "VC", "SX", "TT", "TC", "VI"]
            },
            {
                name: "regionCentralAmerica",
                id: "013",
                countries: ["BZ", "CR", "SV", "GT", "HN", "MX", "NI", "PA"]
            },
            {
                name: "regionSouthAmerica",
                id: "005",
                countries: ["AR", "BO", "BV", "BR", "CL", "CO", "EC", "FK", "GF", "GY", "PY", "PE", "GS", "SR", "UY", "VE"]
            },
            {
                name: "regionNorthernAmerica",
                id: "021",
                countries: ["BM", "CA", "GL", "PM", "US"]
            }
        ]
    },
    {
        name: "regionAsia",
        id: "142",
        includes: [
            {
                name: "regionCentralAsia",
                id: "143",
                countries: ["KZ", "KG", "TJ", "TM", "UZ"]
            },
            {
                name: "regionEasternAsia",
                id: "030",
                countries: ["CN", "HK", "MO", "KP", "JP", "MN", "KR"]
            },
            {
                name: "regionSouthEasternAsia",
                id: "035",
                countries: ["BN", "KH", "ID", "LA", "MY", "MM", "PH", "SG", "TH", "TL", "VN"]
            },
            {
                name: "regionSouthernAsia",
                id: "034",
                countries: ["AF", "BD", "BT", "IN", "IR", "MV", "NP", "PK", "LK"]
            },
            {
                name: "regionWesternAsia",
                id: "145",
                countries: ["AM", "AZ", "BH", "CY", "GE", "IQ", "IL", "JO", "KW", "LB", "OM", "QA", "SA", "PS", "SY", "TR", "AE", "YE"]
            }
        ]
    },
    {
        name: "regionEurope",
        id: "150",
        includes: [
            {
                name: "regionEasternEurope",
                id: "151",
                countries: ["BY", "BG", "CZ", "HU", "PL", "MD", "RO", "RU", "SK", "UA"]
            },
            {
                name: "regionNorthernEurope",
                id: "154",
                countries: ["AX", "DK", "EE", "FO", "FI", "GG", "IS", "IE", "IM", "JE", "LV", "LT", "NO", "SJ", "SE", "GB"]
            },
            {
                name: "regionSouthernEurope",
                id: "039",
                countries: ["AL", "AD", "BA", "HR", "GI", "GR", "VA", "IT", "MT", "ME", "MK", "PT", "SM", "RS", "SI", "ES"]
            },
            {
                name: "regionWesternEurope",
                id: "155",
                countries: ["AT", "BE", "FR", "DE", "LI", "LU", "MC", "NL", "CH"]
            }
        ]
    },
    {
        name: "regionOceania",
        id: "009",
        includes: [
            {
                name: "regionAustraliaAndNewZealand",
                id: "053",
                countries: ["AU", "CX", "CC", "HM", "NZ", "NF"]
            },
            {
                name: "regionMelanesia",
                id: "054",
                countries: ["FJ", "NC", "PG", "SB", "VU"]
            },
            {
                name: "regionMicronesia",
                id: "057",
                countries: ["GU", "KI", "MH", "FM", "NR", "MP", "PW", "UM"]
            },
            {
                name: "regionPolynesia",
                id: "061",
                countries: ["AS", "CK", "PF", "NU", "PN", "WS", "TK", "TO", "TV", "WF"]
            }
        ]
    }
];

type Subregion = {
    name: string;
    id: string;
    countries: string[];
};

type Region = {
    name: string;
    id: string;
    includes: Subregion[];
};

export function getRegionNameById(regionId: string): string | undefined {
    // Check top-level regions
    const region = REGIONS.find((r) => r.id === regionId);
    if (region) {
        return region.name;
    }

    // Check subregions
    for (const region of REGIONS) {
        for (const subregion of region.includes) {
            if (subregion.id === regionId) {
                return subregion.name;
            }
        }
    }

    return undefined;
}

export function isValidRegionId(regionId: string): boolean {
    // Check top-level regions
    if (REGIONS.find((r) => r.id === regionId)) {
        return true;
    }

    // Check subregions
    for (const region of REGIONS) {
        if (region.includes.find((s) => s.id === regionId)) {
            return true;
        }
    }

    return false;
}