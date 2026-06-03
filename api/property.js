module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ATTOM_KEY = process.env.ATTOM_API_KEY;
  if (!ATTOM_KEY) return res.status(500).json({ error: "ATTOM API key not configured." });

  const { street, city, state, zip } = req.body;
  if (!street) return res.status(400).json({ error: "Street address required." });

  try {
    // Build address string for ATTOM
    const address1 = encodeURIComponent(street.trim());
    const address2 = encodeURIComponent([city, state, zip].filter(Boolean).join(" ").trim());

    const url = `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?address1=${address1}&address2=${address2}`;

    const r = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "apikey": ATTOM_KEY,
      },
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.error("ATTOM error:", r.status, JSON.stringify(err));
      return res.status(200).json({ found: false, reason: "Property not found in ATTOM database." });
    }

    const data = await r.json();
    const prop = data?.property?.[0];

    if (!prop) {
      return res.status(200).json({ found: false, reason: "No property data returned." });
    }

    const summary = prop.summary || {};
    const building = prop.building || {};
    const lot = prop.lot || {};
    const assessment = prop.assessment || {};

    const yearBuilt = summary.yearbuilt || building.yearbuilt || null;
    const currentYear = new Date().getFullYear();
    const homeAge = yearBuilt ? currentYear - parseInt(yearBuilt) : null;

    return res.status(200).json({
      found: true,
      yearBuilt: yearBuilt ? String(yearBuilt) : null,
      homeAge: homeAge,
      homeAgeLabel: homeAge ? `${homeAge} years old (built ${yearBuilt})` : null,
      propertyType: summary.proptype || summary.propsubtype || null,
      bedrooms: building.rooms?.bedroomsTotal || building.bedrms || null,
      bathrooms: building.rooms?.bathstotal || building.baths || null,
      sqft: building.size?.universalsize || building.grosssize || null,
      lotSqft: lot.lotsize1 || null,
      stories: building.stories || null,
      assessedValue: assessment.assessed?.assdttlvalue || null,
      lastSaleDate: prop.sale?.amount?.salerecdate || null,
      lastSaleAmount: prop.sale?.amount?.saleamt || null,
      address: {
        street: prop.address?.line1 || street,
        city: prop.address?.locality || city,
        state: prop.address?.countrySubd || state,
        zip: prop.address?.postal1 || zip,
      },
    });

  } catch (err) {
    console.error("property lookup error:", err.message);
    return res.status(200).json({ found: false, reason: "Lookup failed: " + err.message });
  }
};
