import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client";
import { AcaiRecord } from "../../types";
import fetch from "cross-fetch";

const createClient = (signal?: AbortSignal) => {
  return new ApolloClient({
    link: new HttpLink({
      uri: "https://acai-resources-preview---symphony-api-svc-prod-25c5xl4maa-uk.a.run.app/graphql/",
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, { ...init, signal });
      },
    }),
    cache: new InMemoryCache(),
  });
};

export async function sendRefQuery(
  filters: any,
  signal?: AbortSignal
): Promise<AcaiRecord[]> {
  const client = createClient(signal);

  try {
    console.log(`Querying ATLAS with filters:`, filters);

    const query = gql`
      query ACAIRecordsInPassage($acaiRecordsFilters: AcaiRecordFilter) {
        acaiRecords(filters: $acaiRecordsFilters) {
          id
          label
          description
          recordType
          uri
        }
      }
    `;

    const { data } = await client.query({
      query,
      variables: {
        acaiRecordsFilters: filters,
      },
    });

    if (data.acaiRecords && data.acaiRecords.length > 0) {
      return data.acaiRecords;
    } else {
      throw new Error("No ACAI records found.");
    }
  } catch (error) {
    console.error("Error querying ATLAS:", error);
    throw error;
  }
}

export async function sendLabelQuery(
  filters: any,
  signal?: AbortSignal
): Promise<AcaiRecord[]> {
  const client = createClient(signal);

  try {
    console.log(`Querying ATLAS with label filters:`, filters);

    const query = gql`
      query ACAIRecordsByLabel($acaiRecordsFilters: AcaiRecordFilter) {
        acaiRecords(filters: $acaiRecordsFilters) {
          id
          label
          description
          recordType
          uri
        }
      }
    `;

    const { data } = await client.query({
      query,
      variables: {
        acaiRecordsFilters: filters,
      },
    });

    if (data.acaiRecords && data.acaiRecords.length > 0) {
      return data.acaiRecords;
    } else {
      throw new Error("No ACAI records found.");
    }
  } catch (error) {
    console.error("Error querying ATLAS by label:", error);
    throw error;
  }
}

function formatVerseRef(bookId: string, verseRef: string): string {
  const parts = verseRef.split("-");

  if (parts.length === 1) {
    // Single verse or chapter:verse or book only
    return `${bookId} ${verseRef}`.trim();
  } else if (parts.length === 2) {
    const [start, end] = parts;

    if (start.includes(":") && !end.includes(":")) {
      // Range within the same chapter
      const [chapter] = start.split(":");
      return `${bookId} ${start}-${chapter}:${end}`;
    } else if (!end.includes(":")) {
      // Range spanning chapters
      const [startChapter] = start.split(":");
      return `${bookId} ${start}-${bookId} ${startChapter}:${end}`;
    } else {
      // Full range
      return `${bookId} ${start}-${bookId} ${end}`;
    }
  }

  throw new Error("Invalid verse reference format");
}

export async function queryATLAS(
  bookId: string,
  verseRef: string,
  selectedTypes: string[],
  labelInput: string,
  searchType: string,
  signal?: AbortSignal
): Promise<any> {
  const filters: any = {
    recordTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    label: labelInput ? { iContains: labelInput } : undefined,
  };

  if (searchType === "Reference") {
    const usfmRef = formatVerseRef(bookId, verseRef);
    console.log(
      `Querying ATLAS for combined reference: ${usfmRef}, types: ${selectedTypes}, label input: ${labelInput}, search type: ${searchType}`
    );
    filters.scriptureReference = { usfmRef };
    return sendRefQuery(filters, signal);
  } else if (searchType === "Label") {
    console.log(
      `Querying ATLAS by label: ${labelInput}, types: ${selectedTypes}, search type: ${searchType}`
    );
    return sendLabelQuery(filters, signal);
  } else {
    throw new Error("Invalid search type");
  }
}
