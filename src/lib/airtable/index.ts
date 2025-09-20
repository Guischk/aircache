import Airtable from "airtable";

if (!process.env.AIRTABLE_PERSONAL_TOKEN) {
  throw new Error("AIRTABLE_PERSONAL_TOKEN is not set");
}

const airtable = new Airtable({
  apiKey: process.env.AIRTABLE_PERSONAL_TOKEN,
});

if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_BASE_ID is not set");
}

const base = airtable.base(process.env.AIRTABLE_BASE_ID);

export { airtable, base };
